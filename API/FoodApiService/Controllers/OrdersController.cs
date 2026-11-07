using System.Drawing;
using System.Drawing.Printing;
using FoodApiService.Data;
using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Kitchen Staff,Waiter,Cashier,Manager,Admin,SuperAdmin,Chef,Captain")]
public class OrdersController : ControllerBase
{
    public class UpdateKOTItemStatusModel
    {
        public int OrderDetailId { get; set; }
        public string KOTStatus { get; set; }
    }

    private readonly HotelContext _context;
    private readonly IHubContext<KOTNotificationHub> _hub;
    private readonly IConfiguration _configuration;
    private readonly ITenantContext _tenant;
    private readonly DocumentNumberService _numbers;
    private readonly SeatingService _seating;
    private readonly KotPrintService _kotPrint;
    private readonly OrderAlertNotifier _alerts;
    private readonly WhatsAppService _whatsApp;
    private readonly BillCalculator _calc;
    private readonly BackgroundPrinter _printer;

    public OrdersController(HotelContext context, IHubContext<KOTNotificationHub> hub, IConfiguration configuration, ITenantContext tenant, DocumentNumberService numbers, SeatingService seating, KotPrintService kotPrint, OrderAlertNotifier alerts, WhatsAppService whatsApp, BillCalculator calc, BackgroundPrinter printer)
    {
        _calc = calc;
        _printer = printer;
        _kotPrint = kotPrint;
        _alerts = alerts;
        _whatsApp = whatsApp;
        _context = context;
        _hub = hub;
        _configuration = configuration;
        _tenant = tenant;
        _numbers = numbers;
        _seating = seating;
    }

    [HttpPost("CreateOrder")]
    public async Task<IActionResult> InsertOrder([FromBody] AddOrders orderDto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { status = "Error", message = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage), data = (object)null });

        DateOnly businessdate = DateOnly.FromDateTime(DateHelper.GetBusinessDate(DateTime.Now));
        var tenant = await _tenant.GetAsync();
        string username = tenant.Username;

        // Orders are always taken in the caller's own branch.
        int userid = tenant.UserId;
        int branchid = tenant.BranchId;

        if (await _context.Workperiods.Where(w => w.Date == businessdate && w.Branchid == branchid && w.Status == "open").FirstOrDefaultAsync() == null)
            return NotFound(new { status = "Error", message = "There are currently no open work periods", data = (object)null });

        // An order taken on a merged table belongs to the main table of the merge.
        orderDto.TableID = (await _seating.ResolveTableIdAsync(orderDto.TableID)).GetValueOrDefault();

        string? invalid = await ValidateOrderRefs(tenant, orderDto);
        if (invalid != null)
            return BadRequest(new { status = "Error", message = invalid, data = (object)null });

        try
        {
            DateTime businesdate = DateHelper.GetBusinessDate(DateTime.Now);
            string ordernumber = await _numbers.NextAsync(DocumentNumberService.Order, branchid, businesdate);

            // Item names in one query (was one blocking query per item).
            var detailItemIds = orderDto.OrderDetail.Select(d => d.ItemID).Distinct().ToList();
            var itemNames = await _context.Items.AsNoTracking()
                .Where(i => detailItemIds.Contains(i.Itemid))
                .Select(i => new { i.Itemid, i.Itemname })
                .ToDictionaryAsync(i => i.Itemid, i => i.Itemname);

            // Prices and amounts come from the server: item master price, line = qty x price, order = sum of lines.
            var prices = await ItemPricesAsync(detailItemIds, branchid);

            var order = new Order
            {
                Waiterid = orderDto.WaiterID,
                Ordernumber = ordernumber,
                Tableid = orderDto.TableID,
                Timedate = orderDto.TimeDate.ToLocalTime(),
                Customerid = orderDto.CustomerID,
                Bookingid = orderDto.BookingID,
                Totalprice = orderDto.OrderDetail.Sum(d => d.Qty * prices.GetValueOrDefault(d.ItemID)),
                Status = "submitted",
                Billingid = 0,
                Ordertypeid = orderDto.OrderTypeID,
                Comments = orderDto.Comments,
                Guestlabel = NormalizeGuest(orderDto.GuestLabel),
                Branchid = branchid,
                Outletid = tenant.OutletId,
                Createdby = userid,
                Businessdate = businesdate,
                Orderdetails = orderDto.OrderDetail.Select(d => new Orderdetail
                {
                    Itemid = d.ItemID,
                    Qty = d.Qty,
                    Price = prices.GetValueOrDefault(d.ItemID),
                    Sumofprice = d.Qty * prices.GetValueOrDefault(d.ItemID),
                    Branchid = branchid,
                    Outletid = tenant.OutletId,
                    Name = itemNames.GetValueOrDefault(d.ItemID),
                    Kotstatusat = DateTime.Now
                }).ToList()
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();



            // =============================
            // SignalR notification
            // =============================
            var orderTypeName = await _context.Ordertypes
                .Where(ot => ot.Ordertypeid == order.Ordertypeid)
                .Select(ot => ot.Ordertypename)
                .FirstOrDefaultAsync();

            var captainName = username ?? await _context.Users
                .Where(u => u.Userid == userid)
                .Select(u => u.Username)
                .FirstOrDefaultAsync();

            // Get ALL order details of the newly created order
            var orderDetails = await _context.Orderdetails
                .Where(od => od.Orderid == order.Orderid)
                .Select(od => new
                {
                    OrderDetailId = od.Orderdetailid,
                    OrderId = od.Orderid,
                    ItemId = od.Itemid,
                    Name = _context.Items
                        .Where(i => i.Itemid == od.Itemid)
                        .Select(i => i.Itemname)
                        .FirstOrDefault(),
                    Qty = od.Qty,
                    Price = od.Price,
                    SumOfPrice = od.Sumofprice,
                    KOTStatus = od.KOTStatus
                })
                .ToListAsync();

            // Parent order + ALL order details
            var orderUpdatedData = new
            {
                OrderId = order.Orderid,
                OrderNumber = order.Ordernumber,
                OrderStatus = order.Status,
                Captain = captainName,
                Date = order.Timedate.ToString("yyyy-MM-dd HH:mm:ss"),
                OrderTypeId = order.Ordertypeid,
                OrderTypeName = orderTypeName,
                OrderDetails = orderDetails
            };

            // Wrap with Key and Value payload structure
            var signalRData = new
            {
                Key = "Captain", // Change to appropriate key if needed (e.g., "OrderCreated", "Captain", "Chef")
                Value = orderUpdatedData
            };

            // Send real-time notification
            await _hub.Clients.Groups(KOTNotificationHub.GroupsFor(order.Branchid)).SendAsync(
                "OrderUpdated",
                signalRData
            );
            //signalRCall ends  



         





            // One KOT per kitchen, each on that kitchen's printer - printed in the background, so the
            // request never waits for a printer. A failure reaches the user (and branch admins) as a live alert.
            _printer.QueueKot(order.Orderid, userid, branchid);
            var printResults = new List<KotPrintResult>();
            bool printFailed = false;
            string printError = "";


            // =============================
            // SignalR Table Status notification Starts
            // =============================
            // Table Status SignalR notification
            var tableStatusData = new
            {
                tableid = order.Tableid,
                floorid = await _context.Tables
                    .Where(t => t.Tableid == order.Tableid)
                    .Select(t => t.Floorid)
                    .FirstOrDefaultAsync(),
                orderTotalAmount = order.Totalprice,
                orderStatus = order.Status,
                printStatus = !printFailed
            };

            await _hub.Clients.Groups(KOTNotificationHub.GroupsFor(order.Branchid)).SendAsync(
                "TableStatus",
                tableStatusData
            );
            // =============================
            // SignalR Table Status notification Ends
            // =============================



            // More items for a table that is already eating: kitchen and captain see it as an addition.
            if (order.Tableid is > 0 && await _context.Orders.AnyAsync(o => o.Tableid == order.Tableid && o.Orderid != order.Orderid
                    && (o.Status == "submitted" || o.Status == "printed")))
            {
                var info = await OrderAlertNotifier.OrderInfoAsync(_context, order);
                var added = order.Orderdetails.Select(d => $"{d.Name ?? "Item"} x{d.Qty}").ToList();
                await _alerts.SendAsync(_context, order, OrderAlertTypes.ItemsAdded, "Items added",
                    $"{OrderAlertNotifier.Where(info, order)}: {string.Join(", ", added)}",
                    added, toKitchen: true, toCaptain: true, byUserId: userid);
            }

            // The customer of the order (if one was chosen / entered) gets a WhatsApp confirmation.
            if (_whatsApp.IsConfigured && order.Customerid is > 0)
            {
                var customer = await _context.Customers.AsNoTracking().Where(c => c.Customerid == order.Customerid)
                    .Select(c => new { c.Name, c.Contactnumber }).FirstOrDefaultAsync();
                if (customer != null)
                {
                    var info = await OrderAlertNotifier.OrderInfoAsync(_context, order);
                    _whatsApp.SendOrderPlaced(customer.Contactnumber, customer.Name, await _seating.BranchNameAsync(order.Branchid),
                        order.Ordernumber, string.Join(", ", order.Orderdetails.Select(d => $"{d.Name ?? "Item"} x{d.Qty}")),
                        !string.IsNullOrWhiteSpace(info.TableName) ? "Table " + info.TableName : info.OrderTypeName ?? "Order");
                }
            }

            return CreatedAtAction("GetOrderById", new { id = order.Orderid }, new
            {
                status = "Success",
                message = printFailed ? $"Order created successfully. Kitchen printing failed: {printError}" : "Order created successfully. KOT sent to the kitchen printer.",
                printStatus = printFailed ? "Failed" : "Queued",
                printResults,
                data = order
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { status = "Error", message = ex.GetBaseException().Message, data = (object)null });
        }
    }

    // Item master price (the menu's Defaultprice) of each item.
    private async Task<Dictionary<int, decimal>> ItemPricesAsync(IEnumerable<int> itemIds, int? branchId)
    {
        var ids = itemIds.Distinct().ToList();
        return await _context.Items.AsNoTracking()
            .Where(i => ids.Contains(i.Itemid) && i.Branchid == branchId)
            .ToDictionaryAsync(i => i.Itemid, i => i.Defaultprice ?? 0m);
    }

    [HttpPost("UpdateOrder")]
    public async Task<IActionResult> UpdateOrder([FromBody] AddOrders addOrders)
    {
        var tenant = await _tenant.GetAsync();
        var existingOrder = await _context.Orders.ForBranch(tenant).Where(e => e.Orderid == addOrders.OrderId).FirstOrDefaultAsync();
        if (existingOrder == null)
            return NotFound(new { status = "Error", message = "existing order not found" });

        string? invalid = await ValidateOrderRefs(tenant, addOrders, existingOrder.Branchid);
        if (invalid != null)
            return BadRequest(new { status = "Error", message = invalid });

        var details = await _context.Orderdetails.Where(e => e.Orderid == addOrders.OrderId).OrderBy(e => e.Orderdetailid).ToListAsync();
        if (details == null || !details.Any())
            return NotFound(new { status = "Error", message = "order details not found" });

        string? oldComments = existingOrder.Comments;
        existingOrder.Waiterid = addOrders.WaiterID;
        existingOrder.Tableid = addOrders.TableID;
        existingOrder.Bookingid = addOrders.BookingID;
        existingOrder.Ordertypeid = addOrders.OrderTypeID;
        existingOrder.Comments = addOrders.Comments;

        // Lines are matched to the existing ones by item, so an unchanged line keeps its id and
        // KOT status (ready / picked up). A line whose quantity changed goes back to the kitchen.
        var now = DateTime.Now;
        var itemIds = details.Select(d => d.Itemid).Concat(addOrders.OrderDetail.Select(d => d.ItemID)).Distinct().ToList();
        var names = await _context.Items.AsNoTracking().Where(i => itemIds.Contains(i.Itemid))
            .ToDictionaryAsync(i => i.Itemid, i => i.Itemname);
        string NameOf(int itemId) => names.GetValueOrDefault(itemId) ?? "Item";
        var prices = await ItemPricesAsync(itemIds, existingOrder.Branchid);

        var unmatched = details.ToList();
        var changes = new List<string>();
        foreach (var item in addOrders.OrderDetail)
        {
            var line = unmatched.FirstOrDefault(d => d.Itemid == item.ItemID);
            if (line == null)
            {
                _context.Orderdetails.Add(new Orderdetail
                {
                    Orderid = existingOrder.Orderid,
                    Itemid = item.ItemID,
                    Qty = item.Qty,
                    Price = prices.GetValueOrDefault(item.ItemID),
                    Sumofprice = item.Qty * prices.GetValueOrDefault(item.ItemID),
                    Branchid = existingOrder.Branchid,
                    Outletid = existingOrder.Outletid,
                    Kotstatusat = now
                });
                changes.Add($"Added {NameOf(item.ItemID)} x{item.Qty}");
                continue;
            }
            unmatched.Remove(line);
            if (line.Qty != item.Qty)
            {
                changes.Add($"{NameOf(item.ItemID)} qty {line.Qty} -> {item.Qty}");
                line.KOTStatus = null;
                line.Kotstatusat = now;
            }
            // The price the line was ordered at stays; the amount follows the quantity.
            line.Qty = item.Qty;
            line.Sumofprice = line.Qty * line.Price;
        }
        foreach (var removed in unmatched)
            changes.Add($"Removed {NameOf(removed.Itemid)} x{removed.Qty}");
        _context.Orderdetails.RemoveRange(unmatched);
        existingOrder.Totalprice = _context.Orderdetails.Local
            .Where(d => d.Orderid == existingOrder.Orderid && _context.Entry(d).State != EntityState.Deleted)
            .Sum(d => d.Sumofprice ?? d.Qty * d.Price);
        if ((oldComments ?? "").Trim() != (existingOrder.Comments ?? "").Trim())
            changes.Add(string.IsNullOrWhiteSpace(existingOrder.Comments) ? "Comments removed" : $"Comments: {existingOrder.Comments}");

        await _context.SaveChangesAsync();

        if (changes.Count > 0)
        {
            var info = await OrderAlertNotifier.OrderInfoAsync(_context, existingOrder);
            await _alerts.SendAsync(_context, existingOrder, OrderAlertTypes.Edited, "Order edited",
                $"{OrderAlertNotifier.Where(info, existingOrder)}: {string.Join(", ", changes)}",
                changes, toKitchen: true, toCaptain: true, byUserId: tenant.UserId);
        }
        await _alerts.RefreshAsync(existingOrder, "Edited");





        return Ok(new { status = "Success", message = "order updated successfully" });
    }

    [HttpPost("CancelOrder")]
    public async Task<IActionResult> DeleteOrder([FromBody] CancelOrder cancel)
    {
        var tenant = await _tenant.GetAsync();
        var order = await _context.Orders.ForBranch(tenant).FirstOrDefaultAsync(o => o.Orderid == cancel.OrderId);
        if (order == null)
            return NotFound(new { status = "Error", message = "order not found" });

        order.Status = "cancelled";
        order.ComplimentaryF = cancel.ComplimentaryF;
        order.Remarks = cancel.Remarks;
        await _context.SaveChangesAsync();
        await _seating.ReleaseIfFreeAsync(new[] { order.Tableid }, tenant.UserId);

        // The kitchen stops cooking it and the captain knows the order is gone.
        var info = await OrderAlertNotifier.OrderInfoAsync(_context, order);
        var items = await _context.Orderdetails.AsNoTracking().Where(d => d.Orderid == order.Orderid)
            .Select(d => (_context.Items.Where(i => i.Itemid == d.Itemid).Select(i => i.Itemname).FirstOrDefault() ?? "Item") + " x" + d.Qty)
            .ToListAsync();
        await _alerts.SendAsync(_context, order, OrderAlertTypes.Cancelled, "Order cancelled",
            $"{OrderAlertNotifier.Where(info, order)} cancelled" + (string.IsNullOrWhiteSpace(cancel.Remarks) ? "" : $": {cancel.Remarks}"),
            items, toKitchen: true, toCaptain: true, byUserId: tenant.UserId);
        await _alerts.RefreshAsync(order, "Cancelled");
        return Ok(new { status = "Success", message = "order cancelled successfully" });
    }

    [HttpGet("GetOrderByType")]
    public async Task<IActionResult> GetOrderByType(int ordertypeid)
    {
        var tenant = await _tenant.GetAsync();
        var list = await _context.Orders.ForBranch(tenant).Where(o => o.Ordertypeid == ordertypeid && o.Status == "submitted")
            .Select(o => new
            {
                o.Orderid, o.Waiterid, o.Ordernumber, o.Tableid, o.Timedate,
                o.Customerid, o.Bookingid, o.Totalprice, o.Billingid, o.Ordertypeid, o.Status,
                ordertype = _context.Ordertypes.Where(i => i.Ordertypeid == ordertypeid).Select(i => i.Ordertypename).FirstOrDefault(),
                orderdetail = o.Orderdetails.Select(d => new
                {
                    d.Orderdetailid, d.Orderid, d.Itemid, d.Qty, d.Price,
                    Name = _context.Items.Where(i => i.Itemid == d.Itemid).Select(i => i.Itemname).FirstOrDefault(),
                    d.Sumofprice
                }).ToList()
            }).OrderByDescending(p => p.Timedate).ThenByDescending(p => p.Orderid).ToListAsync();

        if (list == null || !list.Any())
            return Ok(new { status = "Succcess", message = "No orders found for the given order type.", data = (object)null });

        return Ok(new { status = "Success", message = "Orders retrieved successfully.", data = list });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Order>> GetOrderById(int id)
    {
        var tenant = await _tenant.GetAsync();
        var order = await _context.Orders.ForBranch(tenant).FirstOrDefaultAsync(o => o.Orderid == id);
        if (order == null) return NotFound();
        return order;
    }

    // Open orders of a table. With byGuest=true only one guest's orders (split bill): guest empty = the first guest.
    [HttpGet("GetOrderByTable")]
    public async Task<IActionResult> GetOrderByTableId(int tableId, [FromQuery] bool byGuest = false, [FromQuery] string? guest = null)
    {
        var tenant = await _tenant.GetAsync();
        tableId = (await _seating.ResolveTableIdAsync(tableId)).GetValueOrDefault();
        string? guestLabel = NormalizeGuest(guest);

        var list = await _context.Orders.ForBranch(tenant).Where(o => o.Tableid == tableId && (o.Status == "submitted" || o.Status == "printed"))
            .Where(o => !byGuest || o.Guestlabel == guestLabel)
            .Include(o => o.Orderdetails)
            .Select(o => new
            {
                o.Orderid, o.Waiterid, o.Ordernumber, o.Tableid, o.Timedate,
                o.Customerid, o.Bookingid, o.Totalprice, o.Billingid, o.Ordertypeid, o.Status, o.Businessdate, o.Guestlabel,
                Customername = _context.Customers.Where(c => c.Customerid == o.Customerid).Select(c => c.Name).FirstOrDefault(),
                Orderdetail = o.Orderdetails.Select(od => new
                {
                    od.Orderdetailid, od.Orderid, od.Itemid,
                    Name = _context.Items.Where(i => i.Itemid == od.Itemid).Select(i => i.Itemname).FirstOrDefault(),
                    od.Qty, od.Price, od.Sumofprice
                }).ToList()
            }).OrderByDescending(p => p.Timedate).ThenByDescending(p => p.Orderid).ToListAsync();


        //for billdetails
        // Get Billing ID from the order
        var billingId = list
            .Where(x => x.Billingid > 0)
            .Select(x => x.Billingid)
            .FirstOrDefault();

        object billDetails = null;

        if (billingId > 0)
        {
            billDetails = await _context.Billheaders.ForBranch(tenant)
                .Where(b => b.Billid == billingId)
                .Select(b => new
                {
                    billid = b.Billid,
                    billname = b.Billname,
                    address = b.Address,
                    customerid = b.Customerid,
                    phone = b.Phone
                })
                .FirstOrDefaultAsync();
        }
        //for billdetails end
        if (list == null || !list.Any())
            return Ok(new { status = "Error", message = $"No active orders found for Table ID: {tableId}", data = (object)null });

        return Ok(new { status = "Success", message = "Orders retrieved successfully", data = list   , billDetails = billDetails });
    }

    [HttpGet("GetOrders")]
    public async Task<IActionResult> GetOrders()
    {
        // Owners see every branch of their outlet, everyone else their own branch.
        var tenant = await _tenant.GetAsync();
        var list = await _context.Orders.ForBranch(tenant)
            .Include(o => o.Orderdetails)
            .Select(o => new
            {
                o.Orderid, o.Waiterid, o.Ordernumber, o.Tableid, o.Timedate,
                o.Customerid, o.Bookingid, o.Totalprice, o.Billingid, o.Ordertypeid, o.Status, o.Comments, o.Businessdate,
                branch = _context.Branches.Where(i => i.Branchid == o.Branchid).Select(i => i.Branchname).FirstOrDefault(),
                Orderdetail = o.Orderdetails.Select(od => new
                {
                    od.Orderdetailid, od.Orderid, od.Itemid, od.Qty, od.Price,
                    Name = _context.Items.Where(i => i.Itemid == od.Itemid).Select(i => i.Itemname).FirstOrDefault(),
                    od.Sumofprice
                }).ToList()
            }).OrderByDescending(p => p.Timedate).ThenByDescending(p => p.Orderid).ToListAsync();

        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No orders found", data = (object)null });

        return Ok(new { status = "Success", message = "Orders retrieved successfully", data = list });
    }

    [Authorize(Roles = "Admin,SuperAdmin,Chef,Captain")]
    [HttpGet("GetOrdersForReport")]
    public async Task<IActionResult> GetOrdersforReport(DateTime? fromDate, DateTime? toDate, string? status, int? orderTypeId = 0, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        IQueryable<Order> query = _context.Orders.ForBranch(tenant, branchId).Include(o => o.Orderdetails).OrderByDescending(o => o.Orderid).AsQueryable();
        if (fromDate.HasValue) query = query.Where(o => o.Businessdate.HasValue && o.Businessdate.Value.Date >= fromDate.Value.Date);
        if (toDate.HasValue) query = query.Where(o => o.Businessdate.HasValue && o.Businessdate.Value.Date < toDate.Value.Date.AddDays(1));
        if (!string.IsNullOrEmpty(status) && status.ToLower() != "all") query = query.Where(o => o.Status.ToLower() == status.ToLower());
        if (orderTypeId > 0) query = query.Where(p => p.Ordertypeid == orderTypeId);

        var list = await query.Select(o => new
        {
            o.Orderid, o.Waiterid, o.Ordernumber, o.Tableid, o.Timedate, o.Customerid, o.Bookingid,
            o.Totalprice, o.Billingid, o.Ordertypeid, o.Status, o.Comments, o.Businessdate,
            branch = _context.Branches.Where(i => i.Branchid == o.Branchid).Select(i => i.Branchname).FirstOrDefault(),
            ordertype = _context.Ordertypes.Where(i => i.Ordertypeid == o.Ordertypeid).Select(i => i.Ordertypename).FirstOrDefault(),
            Orderdetail = o.Orderdetails.Select(od => new
            {
                od.Orderdetailid, od.Orderid, od.Itemid, od.Qty, od.Price, od.KOTStatus,
                Name = _context.Items.Where(i => i.Itemid == od.Itemid).Select(i => i.Itemname).FirstOrDefault(),
                od.Sumofprice
            }).ToList()
        }).ToListAsync();

        if (!list.Any()) return Ok(new { status = "Success", message = "No orders found", data = (object)null });
        return Ok(new { status = "Success", message = "Orders retrieved successfully", data = list });
    }

    [Authorize(Roles = "Admin,SuperAdmin")]
    // Prints an order's KOT again: every kitchen, or one kitchen (kitchenId=0 = items without a kitchen).
    [HttpPost("{id}/ReprintKOT")]
    public async Task<IActionResult> ReprintKot(int id, [FromQuery] int? kitchenId = null)
    {
        var tenant = await _tenant.GetAsync();
        if (!await _context.Orders.ForBranch(tenant).AnyAsync(o => o.Orderid == id))
            return NotFound(new { status = "Error", message = "Order not found" });

        var results = await _kotPrint.PrintOrderAsync(id, kitchenId);
        if (results.Count == 0)
            return BadRequest(new { status = "Error", message = "Nothing to print for this kitchen" });

        var failed = results.Where(r => !r.Ok).ToList();
        return Ok(new
        {
            status = failed.Count == 0 ? "Success" : "Error",
            message = failed.Count == 0 ? $"KOT printed ({string.Join(", ", results.Select(r => r.Kitchen))})" : "Printing failed - " + KotPrintService.Describe(failed),
            data = results
        });
    }

    [HttpPost("PrintOrders")]
    public async Task<IActionResult> PrintOrders([FromBody] List<int> orderIds)
    {
        if (orderIds == null || !orderIds.Any()) return BadRequest(new { status = "Error", message = "No order IDs provided" });
        var tenant = await _tenant.GetAsync();
        var orders = await _context.Orders.ForBranch(tenant).Where(o => orderIds.Contains(o.Orderid)).ToListAsync();
        if (orders == null || !orders.Any()) return NotFound(new { status = "Error", message = "No matching orders found" });
        foreach (var item in orders) item.PrintedF = true;
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = $"{orders.Count} orders updated to printed", data = orders.Select(o => new { o.Orderid, o.Status }).ToList() });
    }

    [Authorize(Roles = "Admin,SuperAdmin,Chef,Captain")]
    [HttpGet("GetOrdersForKOTReport")]
    public async Task<IActionResult> GetOrdersForKOTReport(DateTime? fromDate, DateTime? toDate, string? status, int? orderTypeId = 0, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        IQueryable<Order> source = _context.Orders.ForBranch(tenant, branchId).Include(o => o.Orderdetails).AsQueryable();
        if (fromDate.HasValue) source = source.Where(o => o.Businessdate.HasValue && o.Businessdate.Value.Date >= fromDate.Value.Date);
        if (toDate.HasValue) source = source.Where(o => o.Businessdate.HasValue && o.Businessdate.Value.Date <= toDate.Value.Date);
        if (orderTypeId > 0) source = source.Where(o => o.Ordertypeid == orderTypeId);

        var list = await source.Select(o => new
        {
            o.Orderid, o.Ordernumber, o.Status, o.Totalprice, o.Businessdate,
            OrderStatus = o.Ordertypeid != 1
                ? (o.Status == "cancelled" ? "cancelled" : (o.Orderdetails.Any(od => od.KOTStatus == null || od.KOTStatus.ToLower() == "readytoserve") ? "submitted" : "approved"))
                : o.Status,
            WaiterId = o.Waiterid,
            Waiter = _context.Users.Where(x => x.Userid == o.Waiterid).Select(x => x.Username).FirstOrDefault(),
            o.Comments,
            BranchName = _context.Branches.Where(b => b.Branchid == o.Branchid).Select(b => b.Branchname).FirstOrDefault(),
            OrderTypeName = _context.Ordertypes.Where(t => t.Ordertypeid == o.Ordertypeid).Select(t => t.Ordertypename).FirstOrDefault(),
            Orderdetails = o.Orderdetails.Select(od => new
            {
                od.Orderdetailid, od.Qty, od.Price, od.KOTStatus,
                ItemName = _context.Items.Where(i => i.Itemid == od.Itemid).Select(i => i.Itemname).FirstOrDefault(),
                od.Sumofprice
            }).ToList()
        }).ToListAsync();

        if (!string.IsNullOrEmpty(status)) list = list.Where(o => o.OrderStatus != null && o.OrderStatus.ToLower() == status.ToLower()).ToList();
        if (!list.Any()) return Ok(new { status = "Success", message = "No orders found", data = (object)null });
        return Ok(new { status = "Success", message = "Orders retrieved successfully", data = list });
    }

    //[HttpPost("UpdateKOTItemStatus")]
    //public async Task<IActionResult> UpdateKOTItemStatus([FromBody] UpdateKOTItemStatusModel model)
    //{
    //    var existingOrderDetail = await _context.Orderdetails.FirstOrDefaultAsync(e => e.Orderdetailid == model.OrderDetailId);
    //    if (existingOrderDetail == null) return NotFound(new { status = "Error", message = "order detail not found" });
    //    existingOrderDetail.KOTStatus = model.KOTStatus;
    //    _context.Orderdetails.Update(existingOrderDetail);
    //    await _context.SaveChangesAsync();
    //    //await _hub.Clients.All.SendAsync("OrderUpdated", existingOrderDetail);

    //    //Signal r call Starts

    //    // Get parent order
    //    var order = await _context.Orders
    //        .FirstOrDefaultAsync(o => o.Orderid == existingOrderDetail.Orderid);

    //    if (order == null)
    //    {
    //        return NotFound(new
    //        {
    //            status = "Error",
    //            message = "order not found"
    //        });
    //    }

    //    // Get ALL order details belonging to this parent order
    //    var orderDetails = await _context.Orderdetails
    //        .Where(od => od.Orderid == order.Orderid)
    //        .Select(od => new
    //        {
    //            OrderDetailId = od.Orderdetailid,
    //            OrderId = od.Orderid,
    //            ItemId = od.Itemid,

    //            Name = _context.Items
    //                .Where(i => i.Itemid == od.Itemid)
    //                .Select(i => i.Itemname)
    //                .FirstOrDefault(),

    //            Qty = od.Qty,
    //            Price = od.Price,
    //            SumOfPrice = od.Sumofprice,
    //            KOTStatus = od.KOTStatus
    //        })
    //        .ToListAsync();

    //    // Send parent order + ALL order details
    //    var orderUpdatedData = new
    //    {
    //        OrderId = order.Orderid,
    //        OrderNumber = order.Ordernumber,
    //        OrderStatus = order.Status,

    //        OrderDetails = orderDetails
    //    };

    //    await _hub.Clients.All.SendAsync(
    //        "OrderUpdated",
    //        orderUpdatedData
    //    );
    //    //signalRCall ends
    //    return Ok(new { status = "Success", message = "KOT status updated successfully" });
    //}
    [HttpPost("UpdateKOTItemStatus")]
    public async Task<IActionResult> UpdateKOTItemStatus(
    [FromBody] List<UpdateKOTItemStatusModel> models)
    {
        if (models == null || models.Count == 0)
        {
            return BadRequest(new
            {
                status = "Error",
                message = "No items provided"
            });
        }

        // Get all order details at once
        var orderDetailIds = models
            .Select(x => x.OrderDetailId)
            .ToList();

        var tenant = await _tenant.GetAsync();
        var visibleOrderIds = _context.Orders.ForBranch(tenant).Select(o => o.Orderid);
        var existingOrderDetails = await _context.Orderdetails
            .Where(x => orderDetailIds.Contains(x.Orderdetailid) && visibleOrderIds.Contains(x.Orderid))
            .ToListAsync();

        if (existingOrderDetails.Count != models.Count)
        {
            return NotFound(new
            {
                status = "Error",
                message = "One or more order details not found"
            });
        }

        // Update KOT status for all items
        foreach (var model in models)
        {
            var orderDetail = existingOrderDetails
                .First(x => x.Orderdetailid == model.OrderDetailId);

            if (orderDetail.KOTStatus != model.KOTStatus)
                orderDetail.Kotstatusat = DateTime.Now;
            orderDetail.KOTStatus = model.KOTStatus;
        }

        await _context.SaveChangesAsync();

        //SignalrStarts
        // Get parent order
        var orderId = existingOrderDetails.First().Orderid;

        var order = await _context.Orders
            .FirstOrDefaultAsync(o => o.Orderid == orderId);

        if (order == null)
        {
            return NotFound(new
            {
                status = "Error",
                message = "Order not found"
            });
        }

        // Fetch OrderTypeName and CaptainName
        var orderTypeName = await _context.Ordertypes
            .Where(ot => ot.Ordertypeid == order.Ordertypeid)
            .Select(ot => ot.Ordertypename)
            .FirstOrDefaultAsync();

        var captainName = await _context.Users
            .Where(u => u.Userid == order.Createdby)
            .Select(u => u.Username)
            .FirstOrDefaultAsync();

        // Get ALL order details belonging to this order
        var orderDetails = await _context.Orderdetails
            .Where(od => od.Orderid == order.Orderid)
            .Select(od => new
            {
                OrderDetailId = od.Orderdetailid,
                OrderId = od.Orderid,
                ItemId = od.Itemid,
                Name = _context.Items
                    .Where(i => i.Itemid == od.Itemid)
                    .Select(i => i.Itemname)
                    .FirstOrDefault(),
                Qty = od.Qty,
                Price = od.Price,
                SumOfPrice = od.Sumofprice,
                KOTStatus = od.KOTStatus
            })
            .ToListAsync();

        // SignalR notification
        string notificationKey;

        if (models.Any(x => x.KOTStatus == "readytoserve"))
        {
            notificationKey = "Chef";
        }
        else if (models.Any(x => x.KOTStatus == "submitted"))
        {
            notificationKey = "Captain";
        }
        else
        {
            notificationKey = "Captain"; // fallback
        }

        var orderUpdatedData = new
        {
            OrderId = order.Orderid,
            OrderNumber = order.Ordernumber,
            OrderStatus = order.Status,
            Captain = captainName,
            Date = order.Timedate.ToString("yyyy-MM-dd HH:mm:ss"),
            OrderTypeId = order.Ordertypeid,
            OrderTypeName = orderTypeName,
            OrderDetails = orderDetails
        };

        var signalRData = new
        {
            Key = notificationKey,
            Value = orderUpdatedData
        };

        await _hub.Clients.Groups(KOTNotificationHub.GroupsFor(order.Branchid)).SendAsync(
            "OrderUpdated",
            signalRData
        );
        //Signarr Ends

        // The chef marked items ready: the order's captain comes to pick them up.
        var readyIds = models.Where(m => m.KOTStatus == KotStatuses.ReadyToServe).Select(m => m.OrderDetailId).ToHashSet();
        if (readyIds.Count > 0)
        {
            var info = await OrderAlertNotifier.OrderInfoAsync(_context, order);
            var readyItems = orderDetails.Where(d => readyIds.Contains(d.OrderDetailId)).Select(d => $"{d.Name ?? "Item"} x{d.Qty}").ToList();
            await _alerts.SendAsync(_context, order, OrderAlertTypes.ReadyToServe, "Ready to serve",
                $"{OrderAlertNotifier.Where(info, order)}: {string.Join(", ", readyItems)}",
                readyItems, toKitchen: false, toCaptain: true, byUserId: tenant.UserId);
        }

        return Ok(new
        {
            status = "Success",
            message = "KOT status updated successfully"
        });
    }
    // Table and items on an order must belong to the order's branch; the order type to the outlet (or be global).
    public class SplitItem
    {
        public int OrderDetailId { get; set; }
        public int Qty { get; set; }
    }

    public class SplitRequest
    {
        public int TableId { get; set; }

        // Guest the items go to; empty = the first guest.
        public string? GuestLabel { get; set; }

        // Customer (from the customer master) the items go to; the customer's name becomes the guest tab.
        public int? CustomerId { get; set; }

        public List<SplitItem> Items { get; set; } = new();
    }

    // Guests with open orders on a table (split bill tabs). Guestlabel null = the first guest.
    [HttpGet("TableGuests")]
    public async Task<IActionResult> GetTableGuests(int tableId)
    {
        var tenant = await _tenant.GetAsync();
        tableId = (await _seating.ResolveTableIdAsync(tableId)).GetValueOrDefault();

        var guests = await _context.Orders.ForBranch(tenant)
            .Where(o => o.Tableid == tableId && (o.Status == "submitted" || o.Status == "printed"))
            .GroupBy(o => o.Guestlabel)
            .Select(g => new
            {
                Guestlabel = g.Key,
                Orders = g.Count(),
                Total = g.Sum(o => o.Totalprice) ?? 0m,
                Printed = g.Any(o => o.Status == "printed"),
                Customerid = g.Max(o => o.Customerid)
            })
            .ToListAsync();

        // Customer chosen on the order screen, shown when the guest has no name yet.
        var customerIds = guests.Where(g => g.Customerid > 0).Select(g => g.Customerid!.Value).Distinct().ToList();
        var customerNames = await _context.Customers.AsNoTracking()
            .Where(c => customerIds.Contains(c.Customerid))
            .ToDictionaryAsync(c => c.Customerid, c => c.Name);

        var ordered = guests
            .OrderBy(g => g.Guestlabel != null).ThenBy(g => g.Guestlabel)
            .Select(g => new
            {
                g.Guestlabel, g.Orders, g.Total, g.Printed, g.Customerid,
                Customername = g.Customerid is int cid ? customerNames.GetValueOrDefault(cid) : null
            })
            .ToList();
        return Ok(new { status = "Success", message = "Guests fetched successfully", data = new { tableId, guests = ordered } });
    }

    // Split bill: moves items (whole or part quantity) of a table's unbilled orders to another guest.
    // A whole order that moves keeps its order number; part orders go into one new order for the guest.
    // Totals move with the items, so each guest's bill is calculated on the order screen as usual.
    [HttpPost("Split")]
    [Authorize(Roles = "Manager,Admin,SuperAdmin,Captain,Cashier")]
    public async Task<IActionResult> Split([FromBody] SplitRequest request)
    {
        var tenant = await _tenant.GetAsync();
        if (request?.Items == null || request.Items.Count == 0)
            return BadRequest(new { status = "Error", message = "Choose the items to move" });
        if (request.Items.Any(i => i.Qty < 1) || request.Items.GroupBy(i => i.OrderDetailId).Any(g => g.Count() > 1))
            return BadRequest(new { status = "Error", message = "Invalid item quantities" });
        string? rawLabel = request.GuestLabel?.Trim();
        if (rawLabel != null && rawLabel.Length > 30)
            return BadRequest(new { status = "Error", message = "Guest name is too long (max 30 characters)" });
        string? guestLabel = NormalizeGuest(rawLabel);

        int tableId = (await _seating.ResolveTableIdAsync(request.TableId)).GetValueOrDefault();
        var table = await _context.Tables.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tableid == tableId);
        if (table == null)
            return NotFound(new { status = "Error", message = "Table not found" });

        Customer? customer = null;
        if (request.CustomerId is > 0)
        {
            customer = await _context.Customers.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Customerid == request.CustomerId && c.Branchid == table.Branchid);
            if (customer == null)
                return NotFound(new { status = "Error", message = "Customer not found in this branch" });
            guestLabel = NormalizeGuest(string.IsNullOrWhiteSpace(customer.Name) ? $"Customer {customer.Customerid}" : customer.Name);
        }

        var detailIds = request.Items.Select(i => i.OrderDetailId).ToList();
        var details = await _context.Orderdetails.Include(d => d.Order)
            .Where(d => detailIds.Contains(d.Orderdetailid) && d.Order.Tableid == tableId)
            .ToListAsync();
        if (details.Count != detailIds.Count)
            return NotFound(new { status = "Error", message = "Some items are not on this table" });
        if (details.Any(d => d.Order.Status != "submitted"))
            return BadRequest(new { status = "Error", message = "Only items of orders that are not billed yet can be split. Cancel the printed bill first." });

        var qtyById = request.Items.ToDictionary(i => i.OrderDetailId, i => i.Qty);
        if (details.Any(d => qtyById[d.Orderdetailid] > d.Qty))
            return BadRequest(new { status = "Error", message = "Cannot move more than the ordered quantity" });
        if (details.Any(d => d.Order.Guestlabel == guestLabel))
            return BadRequest(new { status = "Error", message = "Some items already belong to this guest" });

        int relabelled = 0;
        Order? newOrder = null;
        var notes = new List<string>();

        foreach (var orderGroup in details.GroupBy(d => d.Order))
        {
            var order = orderGroup.Key;
            int orderDetailCount = await _context.Orderdetails.CountAsync(d => d.Orderid == order.Orderid);
            bool wholeOrder = orderGroup.Count() == orderDetailCount && orderGroup.All(d => qtyById[d.Orderdetailid] == d.Qty);
            if (wholeOrder)
            {
                order.Guestlabel = guestLabel;
                if (customer != null)
                    order.Customerid = customer.Customerid;
                relabelled++;
                notes.Add(order.Ordernumber ?? order.Orderid.ToString());
                continue;
            }

            if (newOrder == null)
            {
                newOrder = await NewSplitOrder(order, guestLabel, tenant);
                if (customer != null)
                    newOrder.Customerid = customer.Customerid;
            }
            foreach (var detail in orderGroup)
            {
                int qty = qtyById[detail.Orderdetailid];
                decimal unit = detail.Qty > 0 ? (detail.Sumofprice ?? detail.Price * detail.Qty) / detail.Qty : detail.Price;
                decimal movedAmount = Math.Round(unit * qty, 2);

                if (qty == detail.Qty)
                {
                    detail.Order = newOrder;
                }
                else
                {
                    detail.Qty -= qty;
                    detail.Sumofprice = (detail.Sumofprice ?? detail.Price * (detail.Qty + qty)) - movedAmount;
                    newOrder.Orderdetails.Add(new Orderdetail
                    {
                        Itemid = detail.Itemid,
                        Name = detail.Name,
                        Qty = qty,
                        Price = detail.Price,
                        Sumofprice = movedAmount,
                        KOTStatus = detail.KOTStatus,
                        Kotstatusat = detail.Kotstatusat,
                        Branchid = detail.Branchid,
                        Outletid = detail.Outletid
                    });
                }
                order.Totalprice = (order.Totalprice ?? 0m) - movedAmount;
                newOrder.Totalprice = (newOrder.Totalprice ?? 0m) + movedAmount;
                notes.Add($"{detail.Name ?? "Item " + detail.Itemid} x{qty}");
            }
        }

        await _context.SaveChangesAsync();

        string guestName = guestLabel ?? "Unknown";
        _seating.AddHistory(table.Tableid, table.Branchid, table.Outletid, TableEvents.Split, tenant.UserId,
            orderId: newOrder?.Orderid, notes: $"To {guestName}: {string.Join(", ", notes)}");
        await _context.SaveChangesAsync();

        return Ok(new
        {
            status = "Success",
            message = $"Moved to {guestName}",
            data = new { tableId = table.Tableid, guestLabel, newOrderId = newOrder?.Orderid, newOrderNumber = newOrder?.Ordernumber, movedWholeOrders = relabelled }
        });
    }

    // Empty order for a guest's share of a split, copied from the order the items came from.
    private async Task<Order> NewSplitOrder(Order source, string? guestLabel, TenantInfo tenant)
    {
        int branchid = source.Branchid.GetValueOrDefault();
        var order = new Order
        {
            Waiterid = source.Waiterid,
            Ordernumber = await _numbers.NextAsync(DocumentNumberService.Order, branchid, source.Businessdate ?? DateHelper.GetBusinessDate(DateTime.Now)),
            Tableid = source.Tableid,
            Timedate = source.Timedate,
            Customerid = source.Customerid,
            Bookingid = source.Bookingid,
            Totalprice = 0m,
            Status = "submitted",
            Billingid = 0,
            Ordertypeid = source.Ordertypeid,
            Comments = "Split from " + source.Ordernumber,
            Guestlabel = guestLabel,
            Branchid = source.Branchid,
            Outletid = source.Outletid,
            Createdby = tenant.UserId,
            Businessdate = source.Businessdate
        };
        _context.Orders.Add(order);
        return order;
    }

    // Guest tab names are trimmed; empty means the first guest (stored as null).
    private static string? NormalizeGuest(string? label)
    {
        label = label?.Trim();
        if (string.IsNullOrEmpty(label))
            return null;
        return label.Length > 30 ? label[..30] : label;
    }

    private async Task<string?> ValidateOrderRefs(TenantInfo tenant, AddOrders dto, int? orderBranchId = null)
    {
        int branchid = orderBranchId ?? tenant.BranchId;
        if (dto.TableID > 0 && !await _context.Tables.AnyAsync(t => t.Tableid == dto.TableID && t.Branchid == branchid))
            return "Table not found";
        if (!await _context.Ordertypes.ForOutlet(tenant).AnyAsync(t => t.Ordertypeid == dto.OrderTypeID))
            return "Order type not found";

        var itemIds = (dto.OrderDetail ?? new List<AddOrderDetail>()).Select(d => d.ItemID).Distinct().ToList();
        int visibleItems = await _context.Items.CountAsync(i => itemIds.Contains(i.Itemid) && i.Branchid == branchid);
        if (visibleItems != itemIds.Count)
            return "One or more items not found";

        return null;
    }
}
