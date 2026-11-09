using System.Drawing;
using System.Drawing.Printing;
using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Kitchen Staff,Waiter,Cashier,Manager,Admin,SuperAdmin,Captain")]
public class BillController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly IConfiguration _configuration;
    private readonly IHubContext<KOTNotificationHub> _hub;
    private readonly ITenantContext _tenant;
    private readonly DocumentNumberService _numbers;
    private readonly SeatingService _seating;
    private readonly PrintQueue _printQueue;
    private readonly WhatsAppService _whatsApp;
    private readonly BillCalculator _calc;
    private readonly BackgroundPrinter _printer;
    public BillController(HotelContext context, IHubContext<KOTNotificationHub> hub, IConfiguration configuration, ITenantContext tenant, DocumentNumberService numbers, SeatingService seating, PrintQueue printQueue, WhatsAppService whatsApp, BillCalculator calc, BackgroundPrinter printer)
    {
        _printer = printer;
        _calc = calc;
        _printQueue = printQueue;
        _whatsApp = whatsApp;
        _context = context;
        _hub = hub;
        _configuration = configuration;
        _tenant = tenant;
        _numbers = numbers;
        _seating = seating;
    }

    public class CalcRequest
    {
        // Saved orders on the bill.
        public List<int> OrderIds { get; set; } = new();
        public int? DiscountId { get; set; }
        // Amount typed for the "customize" discount.
        public double? CustomDiscount { get; set; }
    }

    // Called only when a discount is chosen on saved orders, so Settle shows the amount to collect.
    // Same result CreateBill saves. Items not sent yet are never priced here.
    [HttpPost("Calculate")]
    public async Task<IActionResult> Calculate([FromBody] CalcRequest request)
    {
        var tenant = await _tenant.GetAsync();
        var ids = (request.OrderIds ?? new()).Distinct().ToList();
        var branches = await _context.Orders.ForBranch(tenant).AsNoTracking().Where(o => ids.Contains(o.Orderid))
            .Select(o => o.Branchid).ToListAsync();
        if (ids.Count == 0 || branches.Count != ids.Count)
            return NotFound(new { status = "Error", message = "One or more orders not found" });

        var result = await _calc.CalculateForOrdersAsync(branches[0].GetValueOrDefault(), ids, request.DiscountId, request.CustomDiscount);
        return Ok(new { status = "Success", data = result.ToResponse() });
    }

    [HttpPost("CreateBill")]
    public async Task<IActionResult> CreateBill([FromBody] BillCreateRequest request)
    {
        try
        {
            if (request.OrderIds == null || !request.OrderIds.Any())
            {
                return BadRequest(new { status = "Error", message = "order IDs cannot be empty" });
            }

            var tenant = await _tenant.GetAsync();
            string username = tenant.Username;
            int userid = tenant.UserId;

            // Every order on the bill must be visible to the caller and belong to one branch;
            // the bill is created in that branch.
            var requestedIds = request.OrderIds.Distinct().ToList();
            var orderBranches = await _context.Orders.ForBranch(tenant)
                .Where(o => requestedIds.Contains(o.Orderid))
                .Select(o => o.Branchid)
                .ToListAsync();
            if (orderBranches.Count != requestedIds.Count)
                return NotFound(new { status = "Error", message = "One or more orders not found" });
            if (orderBranches.Distinct().Count() != 1)
                return BadRequest(new { status = "Error", message = "Orders from different branches cannot be billed together" });
            int branchid = orderBranches[0].GetValueOrDefault();

            var alreadyBilled = await _context.Billdetails
                .Where(o => request.OrderIds.Contains(o.Orderid))
                .Select(o => o.Orderid)
                .ToListAsync();

            if (alreadyBilled.Any())
            {
                return BadRequest(new { status = "Error", message = "Some orders already have a bill generated.", orderIds = alreadyBilled });
            }

            var order = await _context.Orders
                .Where(o => o.Orderid == request.OrderIds[0])
                .FirstOrDefaultAsync();

            string billnumber = await _numbers.NextAsync(DocumentNumberService.Bill, branchid, order.Businessdate ?? DateHelper.GetBusinessDate(DateTime.Now));

            // Amounts are calculated here from the orders, the chosen discount and BillingSettings:TaxInclusive;
            // the client's numbers are not used (only the amount typed for a "customize" discount).
            int? discountId = request.DiscountID?.FirstOrDefault(id => id > 0);
            var calc = await _calc.CalculateForOrdersAsync(branchid, requestedIds, discountId is > 0 ? discountId : null, (double)request.Discount);

            var bill = new Billheader
            {
                Billnumber = billnumber,
                Datetime = request.DateTime.ToLocalTime(),
                Customerid = request.CustomerID,
                Phone = request.Phone,
                Address = request.Address,
                Billname = request.BillName,
                Gstin = request.Gstin,
                Notes = request.Notes,
                Totalamount = (decimal)calc.Total,
                Tax = (decimal)calc.Tax,
                Subtotal = (decimal)calc.SubTotal,
                Discount = (decimal)calc.Discount,
                Extraamount = (decimal)calc.ExtraAmount,
                Paidamount = request.Paidamount,
                Paymentmode = request.Paymentmode,
                Lifecyclestatus = request.Lifecyclestatus,
                Complementaryreason = request.Complementaryreason,
                Iscomplementary = request.Iscomplementary,
                Status = request.Status,
                CreatedBy = userid,
                Branchid = branchid,
                Outletid = order.Outletid ?? tenant.OutletId,
                Businessdate = order.Businessdate
            };

            await _context.Billheaders.AddAsync(bill);
            await _context.SaveChangesAsync();

            var billDetails = request.OrderIds.Select((orderId, index) => new Billdetail
            {
                Billid = bill.Billid,
                Orderid = orderId,
                Taxid = (request.TaxID != null && index < request.TaxID.Count) ? request.TaxID[index] : null,
                Discountid = (request.DiscountID != null && index < request.DiscountID.Count) ? request.DiscountID[index] : null,
                Extraamountid = (request.ExtraamountId != null && index < request.ExtraamountId.Count) ? request.ExtraamountId[index] : null,
                Branchid = bill.Branchid,
                Outletid = bill.Outletid
            }).ToList();

            await _context.Billdetails.AddRangeAsync(billDetails);
            await _context.SaveChangesAsync();

            var orders = await _context.Orders
                .Where(o => request.OrderIds.Contains(o.Orderid))
                .ToListAsync();

            if (orders.Any())
            {
                bool printed = request.Lifecyclestatus == "printed";
                string orderStatus = (request.Lifecyclestatus == "finalized" || request.Lifecyclestatus == "complementary") ? "approved" : "submitted";
                orderStatus = (request.Lifecyclestatus == "cancelled") ? request.Lifecyclestatus : orderStatus;
                orderStatus = (request.Lifecyclestatus == "printed") ? request.Lifecyclestatus : orderStatus;

                foreach (var o in orders)
                {
                    o.Billingid = bill.Billid;
                    o.Status = orderStatus;
                    o.PrintedF = printed;
                }
                await _context.SaveChangesAsync();
                await _seating.ReleaseIfFreeAsync(orders.Select(o => o.Tableid), userid);
                await SendOrderSettledAsync(bill, orders, username);
            }
            if (request.Lifecyclestatus == "finalized")
                await SendPaymentWhatsAppAsync(bill);

            bool printFailed = false;
            string printError = "";
            if (request.Lifecyclestatus?.ToLower() == "printed" || request.Lifecyclestatus?.ToLower() == "finalized")
            {
                // Printed in the background: the request does not wait for the printer.
                // A failure reaches the user (and branch admins) as a live "Printing failed" alert.
                _printer.QueueBill(bill.Billid, userid, bill.Branchid);
            }

            await SendTableStatusAsync(bill, orders);

            return Ok(new
            {
                status = "Success",
                message = printFailed ? $"Bill created successfully. Printing failed: {printError}" : "Bill created successfully. Sent to the printer.",
                billId = bill.Billid,
                printStatus = printFailed ? "Failed" : "Queued"
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { status = "Error", message = ex.Message + ex.InnerException });
        }
    }

    // Settled bill: the customer gets a WhatsApp receipt (bill phone, else the customer master's number).
    private async Task SendPaymentWhatsAppAsync(Billheader bill)
    {
        if (!_whatsApp.IsConfigured)
            return;
        string? phone = bill.Phone, name = bill.Billname;
        if (bill.Customerid is > 0 && (string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(name)))
        {
            var customer = await _context.Customers.AsNoTracking().Where(c => c.Customerid == bill.Customerid)
                .Select(c => new { c.Name, c.Contactnumber }).FirstOrDefaultAsync();
            phone = string.IsNullOrWhiteSpace(phone) ? customer?.Contactnumber : phone;
            name = string.IsNullOrWhiteSpace(name) ? customer?.Name : name;
        }
        _whatsApp.SendPaymentReceived(phone, name, await _seating.BranchNameAsync(bill.Branchid), bill.Billnumber,
            bill.Paidamount ?? bill.Totalamount ?? 0m, bill.Paymentmode);
    }

    [HttpPost("UpdateBill")]
    public async Task<IActionResult> UpdateBill([FromBody] BillUpdateRequest request)
    {
        try
        {
            if (request.BillId <= 0)
            {
                return BadRequest(new { status = "Error", message = "Invalid Bill ID" });
            }

            var tenant = await _tenant.GetAsync();
            int userid = tenant.UserId;

            var bill = await _context.Billheaders.ForBranch(tenant)
                .Include(b => b.Billdetails)
                .FirstOrDefaultAsync(b => (int?)b.Billid == request.BillId);

            if (bill == null)
            {
                return NotFound(new { status = "Error", message = "Bill not found" });
            }

            bill.Paidamount = request.Paidamount;
            bill.Paymentmode = request.Paymentmode;
            bill.Complementaryreason = request.Complementaryreason;
            bill.Iscomplementary = request.Iscomplementary;
            bill.Status = request.Status;
            bill.Updatedby = userid;
            bool wasPaid = bill.Lifecyclestatus == "finalized";
            bill.Lifecyclestatus = request.Lifecyclestatus;

            var orders = await _context.Orders
                .Where(o => o.Billingid == request.BillId)
                .ToListAsync();

            string orderStatus = (request.Lifecyclestatus == "finalized" || request.Lifecyclestatus == "complementary") ? "approved" : "submitted";
            orderStatus = (request.Lifecyclestatus == "cancelled") ? request.Lifecyclestatus : orderStatus;

            foreach (var o in orders)
            {
                o.Billingid = bill.Billid;
                o.Status = orderStatus;
                o.PrintedF = false;
            }
            await _context.SaveChangesAsync();
            await _seating.ReleaseIfFreeAsync(orders.Select(o => o.Tableid), userid);
            // Same notifications as CreateBill: settling a printed bill must reach the KOT / table screens too.
            await SendOrderSettledAsync(bill, orders, tenant.Username);
            if (!wasPaid && bill.Lifecyclestatus == "finalized")
                await SendPaymentWhatsAppAsync(bill);

            bool printFailed = false;
            string printError = "";
            if (request.Lifecyclestatus?.ToLower() == "printed" || request.Lifecyclestatus?.ToLower() == "finalized")
            {
                // Printed in the background: the request does not wait for the printer.
                // A failure reaches the user (and branch admins) as a live "Printing failed" alert.
                _printer.QueueBill(bill.Billid, userid, bill.Branchid);
            }

            await SendTableStatusAsync(bill, orders);

            return Ok(new
            {
                status = "Success",
                message = printFailed ? $"Bill updated successfully. Printing failed: {printError}" : "Bill updated successfully. Sent to the printer.",
                billId = bill.Billid,
                printStatus = printFailed ? "Failed" : "Queued"
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { status = "Error", message = ex.Message + " " + ex.InnerException?.Message });
        }
    }

    // SignalR "OrderSettled" for every order of the bill (sent by CreateBill and UpdateBill).
    private async Task SendOrderSettledAsync(Billheader bill, List<Order> orders, string username)
    {
        // =============================
        // SignalR Notification (OrderSettled)
        // =============================
        foreach (var ord in orders)
        {
            var orderTypeName = await _context.Ordertypes
                .Where(ot => ot.Ordertypeid == ord.Ordertypeid)
                .Select(ot => ot.Ordertypename)
                .FirstOrDefaultAsync();

            var captainName = await _context.Users
                .Where(u => u.Userid == ord.Createdby)
                .Select(u => u.Username)
                .FirstOrDefaultAsync() ?? username;

            var orderDetails = await _context.Orderdetails
                .Where(od => od.Orderid == ord.Orderid)
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

            var settledOrderPayload = new
            {
                OrderId = ord.Orderid,
                OrderNumber = ord.Ordernumber,
                OrderStatus = ord.Status,
                BillId = bill.Billid,
                BillNumber = bill.Billnumber,
                LifecycleStatus = bill.Lifecyclestatus,
                Captain = captainName,
                Date = ord.Timedate.ToString("yyyy-MM-dd HH:mm:ss"),
                OrderTypeId = ord.Ordertypeid,
                OrderTypeName = orderTypeName,
                OrderDetails = orderDetails
            };

            // Wrap with Key and Value payload structure
            var signalRData = new
            {
                Key = "Cashier", // Set to your target audience key (e.g., "Settled", "Captain", or "Cashier")
                Value = settledOrderPayload
            };

            await _hub.Clients.Groups(KOTNotificationHub.GroupsFor(bill.Branchid)).SendAsync("OrderSettled", signalRData);
        }
        // =============================
        // SignalR end
        // =============================
    }

    // SignalR "TableStatus" for the tables of the bill's orders (sent by CreateBill and UpdateBill).
    private async Task SendTableStatusAsync(Billheader bill, List<Order> orders)
    {
        // =============================
        // SignalR Notification (Table Status)
        // =============================

        foreach (var ord in orders)
        {
            if (ord.Tableid == null || ord.Tableid <= 0)
                continue;

            var table = await _context.Tables
                .FirstOrDefaultAsync(t => t.Tableid == ord.Tableid);

            if (table == null)
                continue;

            var tableStatusPayload = new
            {
                tableid = table.Tableid,
                floorid = table.Floorid,
                orderTotalAmount = ord.Totalprice ?? 0,
                orderStatus = ord.Status,
                printStatus = ord.PrintedF
            };

            await _hub.Clients.Groups(KOTNotificationHub.GroupsFor(bill.Branchid)).SendAsync(
                "TableStatus",
                tableStatusPayload
            );
        }

        // =============================
        // SignalR Notification End
        // =============================
    }

    [HttpGet("GetAllBills")]
    public async Task<IActionResult> GetAllBills()
    {
        // Owners see every branch of their outlet, everyone else their own branch.
        var tenant = await _tenant.GetAsync();
        var list = await _context.Billheaders.ForBranch(tenant)
            .Include(b => b.Billdetails)
            .Select(b => new
            {
                b.Billid,
                b.Billname,
                b.Gstin,
                b.Address,
                b.Customerid,
                b.Notes,
                b.Datetime,
                b.Phone,
                b.Totalamount,
                b.Subtotal,
                b.Extraamount,
                b.Tax,
                b.Discount,
                b.Lifecyclestatus,
                billdetail = b.Billdetails.Select(d => new { d.Billdetailid, d.Billid, d.Orderid, d.Taxid, d.Discountid, d.Extraamountid }).ToList()
            })
            .OrderByDescending(p => p.Datetime)
            .ThenByDescending(p => p.Billid)
            .ToListAsync();

        if (!list.Any())
        {
            return Ok(new { status = "Success", message = "no bills found", data = (object)null });
        }

        return Ok(new { status = "Success", message = "bills retrieved successfully", data = list });
    }

    [HttpGet("GetBillById/{id}")]
    public async Task<IActionResult> GetBillById(int id)
    {
        var tenant = await _tenant.GetAsync();
        var bill = await _context.Billheaders.ForBranch(tenant)
            .Include(b => b.Billdetails)
            .Select(o => new
            {
                o.Billid,
                o.Billname,
                o.Gstin,
                o.Address,
                o.Customerid,
                o.Notes,
                o.Datetime,
                o.Phone,
                o.Totalamount,
                o.Tax,
                o.Discount,
                o.Subtotal,
                o.Extraamount,
                o.Paidamount,
                o.Paymentmode,
                o.Status,
                o.Iscomplementary,
                o.Complementaryreason,
                o.Lifecyclestatus,
                o.Businessdate,
                createdby = _context.Users
                    .Where(p => (int?)p.Userid == o.CreatedBy)
                    .Select(m => m.Username)
                    .FirstOrDefault(),
                billdetail = o.Billdetails.Select(d => new { d.Billdetailid, d.Billid, d.Orderid, d.Taxid, d.Discountid, d.Extraamountid }).ToList()
            })
            .FirstOrDefaultAsync(b => b.Billid == id);

        if (bill == null)
        {
            return Ok(new { status = "Error", message = "Bill not found." });
        }

        return Ok(new { status = "Success", message = "Bill retrieved successfully.", data = bill });
    }

    [HttpPost("DeleteBill/{id}")]
    public async Task<IActionResult> DeleteBill(int id)
    {
        var tenant = await _tenant.GetAsync();
        var bill = await _context.Billheaders.ForBranch(tenant)
            .Include(b => b.Billdetails)
            .FirstOrDefaultAsync(b => b.Billid == id);

        if (bill == null)
        {
            return NotFound(new { status = "Error", message = "Bill not found." });
        }

        _context.Billdetails.RemoveRange(bill.Billdetails);
        _context.Billheaders.Remove(bill);
        await _context.SaveChangesAsync();

        return Ok(new { status = "Success", message = "Bill deleted successfully!" });
    }

    [Authorize(Roles = "Admin,SuperAdmin,Captain")]
    [HttpGet("GetBillOrderReport")]
    public async Task<IActionResult> GetBillOrderReport(DateTime? fromDate, DateTime? toDate, string? status, string? orderType, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        // Same filters and result as before, but flat queries + name lookups instead of a sub-query per
        // bill / order / item (and the order-type filter by id, which used to time out on large data).
        var query = _context.Billheaders.AsNoTracking().ForBranch(tenant, branchId);
        if (fromDate.HasValue)
        {
            query = query.Where(b => b.Businessdate.Value.Date >= fromDate.Value.Date);
        }
        if (toDate.HasValue)
        {
            query = query.Where(b => b.Businessdate.Value.Date <= toDate.Value.Date);
        }
        if (!string.IsNullOrWhiteSpace(status) && status.ToLower() != "all")
        {
            query = query.Where(b => b.Status.ToLower() == status.ToLower());
        }
        if (!string.IsNullOrWhiteSpace(orderType) && orderType.ToLower() != "all")
        {
            string typeName = orderType.ToLower();
            var typeIds = await _context.Ordertypes.AsNoTracking()
                .Where(o => o.Ordertypename.ToLower() == typeName)
                .Select(o => (int?)o.Ordertypeid)
                .ToListAsync();
            query = query.Where(b => b.Billdetails.Any(d => typeIds.Contains(d.Order.Ordertypeid)));
        }

        var bills = await query
            .OrderByDescending(b => b.Datetime).ThenByDescending(b => b.Billid)
            .Select(b => new
            {
                b.Billid, b.Billnumber, b.Billname, b.Gstin, b.Address, b.Customerid, b.Notes, b.Datetime, b.Phone,
                b.Totalamount, b.Subtotal, b.Extraamount, b.Tax, b.Discount, b.Discountid, b.Taxid, b.Paidamount,
                b.Paymentmode, b.Status, b.Complementaryreason, b.Iscomplementary, b.Businessdate, b.Lifecyclestatus,
                b.Branchid, b.CreatedBy
            })
            .ToListAsync();
        var billIds = bills.Select(b => b.Billid).ToList();

        var billOrders = await (from d in _context.Billdetails.AsNoTracking()
                                join o in _context.Orders.AsNoTracking() on d.Orderid equals o.Orderid
                                where billIds.Contains(d.Billid)
                                orderby d.Billdetailid
                                select new
                                {
                                    d.Billid, d.Orderid, o.Ordernumber, o.Timedate, o.Status, o.Totalprice, o.Tableid,
                                    o.Waiterid, o.Customerid, o.Ordertypeid
                                })
            .ToListAsync();
        var orderIds = billOrders.Select(o => o.Orderid).Distinct().ToList();
        var lines = await _context.Orderdetails.AsNoTracking()
            .Where(od => orderIds.Contains(od.Orderid))
            .OrderBy(od => od.Orderdetailid)
            .Select(od => new { od.Orderdetailid, od.Orderid, od.Itemid, od.Qty, od.Price, od.Sumofprice })
            .ToListAsync();

        var itemIdsUsed = lines.Select(l => l.Itemid).Distinct().ToList();
        var itemNamesById = await _context.Items.AsNoTracking().Where(i => itemIdsUsed.Contains(i.Itemid))
            .ToDictionaryAsync(i => i.Itemid, i => i.Itemname);
        var typeNames = await _context.Ordertypes.AsNoTracking().ToDictionaryAsync(o => o.Ordertypeid, o => o.Ordertypename);
        var branchIdsUsed = bills.Select(b => b.Branchid).Distinct().ToList();
        var branchNames = await _context.Branches.AsNoTracking().Where(br => branchIdsUsed.Contains((int?)br.Branchid))
            .ToDictionaryAsync(br => br.Branchid, br => br.Branchname);
        var userIdsUsed = bills.Select(b => b.CreatedBy).Distinct().ToList();
        var userNames = await _context.Users.AsNoTracking().Where(u => userIdsUsed.Contains((int?)u.Userid))
            .ToDictionaryAsync(u => u.Userid, u => u.Username);
        var linesByOrder = lines.ToLookup(l => l.Orderid);
        var ordersByBill = billOrders.ToLookup(o => o.Billid);

        var list = bills.Select(b => new
        {
            b.Billid,
            b.Billnumber,
            b.Billname,
            b.Gstin,
            b.Address,
            b.Customerid,
            b.Notes,
            b.Datetime,
            b.Phone,
            b.Totalamount,
            b.Subtotal,
            b.Extraamount,
            b.Tax,
            b.Discount,
            b.Discountid,
            b.Taxid,
            b.Paidamount,
            b.Paymentmode,
            b.Status,
            b.Complementaryreason,
            b.Iscomplementary,
            b.Businessdate,
            b.Lifecyclestatus,
            branch = b.Branchid is int bid ? branchNames.GetValueOrDefault(bid) : null,
            createdby = b.CreatedBy is int uid ? userNames.GetValueOrDefault(uid) : null,
            Orders = ordersByBill[b.Billid].Select(d => new
            {
                d.Orderid,
                d.Ordernumber,
                d.Timedate,
                Status = d.Status,
                d.Totalprice,
                d.Tableid,
                d.Waiterid,
                Customerid = d.Customerid,
                d.Ordertypeid,
                OrderType = d.Ordertypeid is int tid ? typeNames.GetValueOrDefault(tid) : null,
                OrderDetails = linesByOrder[d.Orderid].Select(od => new
                {
                    od.Orderdetailid,
                    od.Itemid,
                    Name = itemNamesById.GetValueOrDefault(od.Itemid),
                    od.Qty,
                    od.Price,
                    od.Sumofprice
                }).ToList()
            }).ToList()
        }).ToList();

        if (!list.Any())
        {
            return Ok(new { status = "Success", message = "No bills found", data = (object)null });
        }

        decimal totalAmount = list.Sum(b => b.Totalamount.GetValueOrDefault());
        decimal subtotal = list.Sum(b => b.Subtotal.GetValueOrDefault());

        var orderTypeWiseTotals = list
            .SelectMany(b => b.Orders.Select(o => new
            {
                o.Ordertypeid,
                o.OrderType,
                OrderAmount = o.Totalprice.GetValueOrDefault(),
                BillSubtotal = b.Subtotal.GetValueOrDefault(),
                BillTax = b.Tax.GetValueOrDefault(),
                BillTotal = b.Subtotal.GetValueOrDefault() + b.Tax.GetValueOrDefault(),
                b.Billid,
                b.Status,
                b.Iscomplementary
            }))
            .GroupBy(x => new { x.Ordertypeid, x.OrderType })
            .Select(g => new
            {
                OrderTypeId = g.Key.Ordertypeid,
                Ordertype = g.Key.OrderType,
                OrderCount = g.Count(),
                SubTotalAmount = g.Select(x => x.Billid).Distinct().Sum(id => g.First(x => x.Billid == id).BillSubtotal),
                TotalTax = g.Select(x => x.Billid).Distinct().Sum(id => g.First(x => x.Billid == id).BillTax),
                TotalWithTax = g.Select(x => x.Billid).Distinct().Sum(id => g.First(x => x.Billid == id).BillTotal),
                PaidAmount = g.Where(x => x.Status == "paid" && !x.Iscomplementary.GetValueOrDefault())
                    .Select(x => x.Billid).Distinct()
                    .Sum(id => g.First(x => x.Billid == id).BillTotal),
                UnpaidAmount = g.Where(x => x.Status == "unpaid" && !x.Iscomplementary.GetValueOrDefault())
                    .Select(x => x.Billid).Distinct()
                    .Sum(id => g.First(x => x.Billid == id).BillTotal),
                ComplementaryAmount = g.Where(x => x.Iscomplementary.GetValueOrDefault())
                    .Select(x => x.Billid).Distinct()
                    .Sum(id => g.First(x => x.Billid == id).BillTotal)
            })
            .ToList();

        var itemWiseOrders = list
            .SelectMany(b => b.Orders)
            .SelectMany(o => o.OrderDetails)
            .Where(x => x.Qty > 0)
            .GroupBy(x => new { x.Itemid, x.Name })
            .Select(g => new
            {
                g.Key.Itemid,
                ItemName = g.Key.Name,
                Qty = g.Sum(x => x.Qty),
                Amount = g.Sum(x => x.Sumofprice.GetValueOrDefault())
            })
            .Where(x => x.Qty > 0)
            .OrderByDescending(x => x.Qty)
            .ToList();

        return Ok(new
        {
            status = "Success",
            message = "Bill order report retrieved successfully",
            totalAmount,
            subtotal,
            orderTypeWiseTotals,
            data = list,
            itemWiseOrders
        });
    }

    [HttpGet("GetDashbordReport")]
    public async Task<IActionResult> GetDashbordReport(DateTime? fromDate, DateTime? toDate, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        var query = _context.Billheaders.ForBranch(tenant, branchId)
            .Include(b => b.Billdetails)
                .ThenInclude(d => d.Order)
            .AsQueryable();

        if (fromDate.HasValue)
        {
            query = query.Where(b => b.Businessdate.HasValue && b.Businessdate.Value.Date >= fromDate.Value.Date);
        }
        if (toDate.HasValue)
        {
            query = query.Where(b => b.Businessdate.HasValue && b.Businessdate.Value.Date <= toDate.Value.Date);
        }

        // Flat rows (bill x order), in the same order as before (bill id, then bill detail id).
        var rows = await (from b in query.AsNoTracking()
                          join d in _context.Billdetails.AsNoTracking() on b.Billid equals d.Billid
                          join o in _context.Orders.AsNoTracking() on d.Orderid equals o.Orderid
                          orderby b.Billid, d.Billdetailid
                          select new
                          {
                              o.Totalprice, o.Ordertypeid, o.Status, o.ComplimentaryF,
                              BillAmount = b.Subtotal ?? 0m,
                              Tax = b.Tax ?? 0m
                          })
            .ToListAsync();

        if (!rows.Any() && !await query.AnyAsync())
        {
            return Ok(new { status = "Success", message = "No bills found", data = (object)null });
        }

        var typeNames = await _context.Ordertypes.AsNoTracking().ToDictionaryAsync(o => o.Ordertypeid, o => o.Ordertypename);
        var allOrders = rows.Select(r => new
        {
            r.Totalprice, r.Ordertypeid, r.Status, r.ComplimentaryF,
            OrderTypeName = r.Ordertypeid is int tid ? typeNames.GetValueOrDefault(tid) : null,
            r.BillAmount, r.Tax
        }).ToList();

        var orderTypeWiseTotals = allOrders
            .Where(o => o.Status == "approved")
            .GroupBy(o => new { o.Ordertypeid, o.OrderTypeName })
            .Select(g => new
            {
                OrderTypeId = g.Key.Ordertypeid,
                g.Key.OrderTypeName,
                TotalOrderAmount = g.Sum(x => x.Totalprice.GetValueOrDefault()),
                SubTotalAmount = g.Sum(x => x.BillAmount),
                TotalTax = g.Sum(x => x.Tax),
                OrderCount = g.Count()
            })
            .ToList();

        decimal canceledOrdersTotalAmount = allOrders
            .Where(o => o.Status == "cancelled")
            .Sum(o => o.Totalprice.GetValueOrDefault());

        decimal complimentaryTotalAmount = allOrders
            .Where(o => o.Status == "complementary" && o.ComplimentaryF.GetValueOrDefault())
            .Sum(o => o.Totalprice.GetValueOrDefault());

        return Ok(new
        {
            status = "Success",
            message = "Order type-wise totals retrieved successfully",
            orderTypeWiseTotals,
            canceledOrdersTotalAmount,
            complimentaryTotalAmount
        });
    }

    [Authorize(Roles = "Admin,SuperAdmin")]
    [HttpGet("GetTableWiseBillSummary")]
    public async Task<IActionResult> GetTableWiseBillSummary(DateTime? fromDate, DateTime? toDate, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        var query = _context.Billheaders.ForBranch(tenant, branchId)
            .Include(b => b.Billdetails)
                .ThenInclude(d => d.Order)
            .AsQueryable();

        if (fromDate.HasValue)
        {
            query = query.Where(b => (b.Businessdate ?? DateTime.MinValue).Date >= fromDate.Value.Date);
        }
        if (toDate.HasValue)
        {
            query = query.Where(b => (b.Businessdate ?? DateTime.MinValue).Date <= toDate.Value.Date);
        }

        var list = await query
            .SelectMany(b => b.Billdetails
                .Where(d => d.Order != null && d.Order.Ordertypeid == 1)
                .Select(d => new
                {
                    TableId = d.Order.Tableid,
                    OrderDate = d.Order.Timedate,
                    Amount = d.Order.Totalprice
                }))
            .GroupBy(x => x.TableId)
            .Select(g => new
            {
                TableId = g.Key,
                TotalAmount = g.Sum(x => x.Amount),
                Count = g.Count()
            })
            .ToListAsync();

        if (!list.Any())
        {
            return Ok(new { status = "Success", message = "No records found for selected date range", data = (object)null });
        }

        return Ok(new { status = "Success", message = "Table-wise bill summary retrieved successfully", data = list });
    }

    [Authorize(Roles = "Admin,SuperAdmin")]
    [HttpGet("GetItemWiseSalesReport")]
    public async Task<IActionResult> GetItemWiseSalesReport(DateTime? fromDate, DateTime? toDate, int? itemid = 0, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        var branchIds = tenant.BranchesFor(branchId);
        var query = _context.Orderdetails
            .Where(od => od.Order.Status == "approved" && od.Order.Branchid != null && branchIds.Contains(od.Order.Branchid.Value));

        if (fromDate.HasValue && toDate.HasValue)
        {
            query = query.Where(od => od.Order.Businessdate >= fromDate && od.Order.Businessdate <= toDate && ((int?)od.Itemid == itemid || itemid == 0));
        }

        var data = await query
            .GroupBy(od => new { od.Itemid })
            .Select(g => new
            {
                ItemId = g.Key.Itemid,
                ItemName = _context.Items
                    .Where(i => i.Itemid == g.Key.Itemid)
                    .Select(i => i.Itemname)
                    .FirstOrDefault(),
                TotalQuantity = g.Sum(od => od.Qty),
                ItemWiseTotalPrice = g.Sum(od => od.Sumofprice),
                OrderLevelTotalPrice = g.Sum(od => od.Order.Totalprice)
            })
            .OrderByDescending(r => r.ItemWiseTotalPrice)
            .ToListAsync();

        return Ok(new { status = "Success", message = "Item-wise sales report generated successfully", data });
    }

    [HttpGet("GetBillOrderIdsReport")]
    public async Task<IActionResult> GetBillOrderIdsReport(DateTime? fromDate, DateTime? toDate, string? status, string? orderType, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();

        var query = _context.Billheaders.AsQueryable();

        query = query.ForBranch(tenant, branchId);
        if (fromDate.HasValue)
        {
            query = query.Where(b => b.Businessdate.Value.Date >= fromDate.Value.Date);
        }
        if (toDate.HasValue)
        {
            query = query.Where(b => b.Businessdate.Value.Date <= toDate.Value.Date);
        }
        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(b => b.Status.ToLower() == status.ToLower());
        }
        if (!string.IsNullOrWhiteSpace(orderType) && !orderType.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(b => b.Billdetails.Any(d =>
                _context.Ordertypes
                    .Where(o => (int?)o.Ordertypeid == d.Order.Ordertypeid)
                    .Select(o => o.Ordertypename.ToLower())
                    .FirstOrDefault() == orderType.ToLower()));
        }

        var data = await query
            .Select(b => new
            {
                BillId = b.Billid,
                TotalAmount = b.Totalamount,
                Orders = b.Billdetails.Select(d => d.Orderid).Distinct().ToList()
            })
            .OrderByDescending(x => x.BillId)
            .ToListAsync();

        return Ok(new { status = "Success", message = "Data retrieved successfully", data });
    }

    [Authorize(Roles = "Admin,SuperAdmin,Captain")]
    [HttpGet("GetComplementaryReport")]
    public async Task<IActionResult> GetComplementaryReport(DateTime? fromDate, DateTime? toDate, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();

        var query = _context.Billheaders.Where(x => x.Iscomplementary == true);

        query = query.ForBranch(tenant, branchId);
        if (fromDate.HasValue)
        {
            query = query.Where(x => x.Businessdate >= fromDate.Value.Date);
        }
        if (toDate.HasValue)
        {
            query = query.Where(x => x.Businessdate <= toDate.Value.Date);
        }

        var list = await query
            .Select(x => new
            {
                x.Billid,
                x.Billnumber,
                x.Businessdate,
                x.Billname,
                x.Phone,
                x.Subtotal,
                x.Tax,
                x.Totalamount,
                x.Complementaryreason,
                CreatedBy = _context.Users
                    .Where(u => (int?)u.Userid == x.CreatedBy)
                    .Select(u => u.Username)
                    .FirstOrDefault()
            })
            .OrderByDescending(x => x.Billid)
            .ToListAsync();

        return Ok(new
        {
            status = "Success",
            count = list.Count,
            totalAmount = list.Sum(x => x.Totalamount.GetValueOrDefault()),
            data = list
        });
    }

    [Authorize(Roles = "Admin,SuperAdmin,Captain")]
    [HttpGet("GetPaymentWiseReport")]
    public async Task<IActionResult> GetPaymentWiseReport(DateTime? fromDate, DateTime? toDate, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();

        var query = _context.Billheaders.AsQueryable();

        query = query.ForBranch(tenant, branchId);
        if (fromDate.HasValue)
        {
            query = query.Where(x => x.Businessdate >= fromDate.Value.Date);
        }
        if (toDate.HasValue)
        {
            query = query.Where(x => x.Businessdate <= toDate.Value.Date);
        }

        var data = await query
            .GroupBy(x => x.Paymentmode)
            .Select(g => new
            {
                PaymentMode = g.Key,
                BillCount = g.Count(),
                TotalAmount = g.Sum(x => x.Totalamount ?? 0m),
                PaidAmount = g.Sum(x => x.Paidamount ?? 0m)
            })
            .OrderByDescending(x => x.TotalAmount)
            .ToListAsync();

        return Ok(new { status = "Success", data });
    }

    [Authorize(Roles = "Admin,SuperAdmin,Captain")]
    [HttpGet("GetCaptainWiseSalesReport")]
    public async Task<IActionResult> GetCaptainWiseSalesReport(DateTime? fromDate, DateTime? toDate, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();

        var query = _context.Billheaders
            .Include(b => b.Billdetails)
                .ThenInclude(d => d.Order)
            .AsQueryable();

        query = query.ForBranch(tenant, branchId);
        if (fromDate.HasValue)
        {
            query = query.Where(b => b.Businessdate >= fromDate.Value.Date);
        }
        if (toDate.HasValue)
        {
            query = query.Where(b => b.Businessdate <= toDate.Value.Date);
        }

        var data = await query
            .SelectMany(b => b.Billdetails)
            .Where(d => d.Order != null)
            .GroupBy(d => d.Order.Waiterid)
            .Select(g => new
            {
                CaptainId = g.Key,
                CaptainName = _context.Users
                    .Where(u => u.Userid == g.Key)
                    .Select(u => u.Username)
                    .FirstOrDefault(),
                OrderCount = g.Select(x => x.Orderid).Distinct().Count(),
                SalesAmount = (from id in g.Select(x => x.Orderid).Distinct()
                               join o in _context.Orders on id equals o.Orderid
                               select o.Totalprice ?? 0m).Sum()
            })
            .OrderByDescending(x => x.SalesAmount)
            .ToListAsync();

        return Ok(new { status = "Success", data });
    }

    [Authorize(Roles = "Admin,SuperAdmin,Captain")]
    [HttpGet("GetCustomerWiseReport")]
    public async Task<IActionResult> GetCustomerWiseReport(DateTime? fromDate, DateTime? toDate, int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();

        var query = _context.Billheaders.AsQueryable();

        query = query.ForBranch(tenant, branchId);
        if (fromDate.HasValue)
        {
            query = query.Where(x => x.Businessdate >= fromDate.Value.Date);
        }
        if (toDate.HasValue)
        {
            query = query.Where(x => x.Businessdate <= toDate.Value.Date);
        }

        var data = await query
            .GroupBy(x => x.Customerid)
            .Select(g => new
            {
                CustomerId = g.Key,
                CustomerName = g.Select(x => x.Billname).FirstOrDefault(),
                Phone = g.Select(x => x.Phone).FirstOrDefault(),
                BillCount = g.Count(),
                TotalAmount = g.Sum(x => x.Totalamount ?? 0m),
                PaidAmount = g.Sum(x => x.Paidamount ?? 0m),
                UnpaidAmount = g.Sum(x => (x.Totalamount ?? 0m) - (x.Paidamount ?? 0m))
            })
            .OrderByDescending(x => x.TotalAmount)
            .ToListAsync();

        return Ok(new { status = "Success", data });
    }
}
