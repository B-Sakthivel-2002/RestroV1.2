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
    public BillController(HotelContext context, IHubContext<KOTNotificationHub> hub, IConfiguration configuration, ITenantContext tenant, DocumentNumberService numbers, SeatingService seating, PrintQueue printQueue)
    {
        _printQueue = printQueue;
        _context = context;
        _hub = hub;
        _configuration = configuration;
        _tenant = tenant;
        _numbers = numbers;
        _seating = seating;
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
                Totalamount = request.TotalAmount,
                Tax = request.Tax,
                Subtotal = request.SubTotal,
                Discount = request.Discount,
                Extraamount = request.ExtraAmount,
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

            bool printFailed = false;
            string printError = "";
            if (request.Lifecyclestatus?.ToLower() == "printed" || request.Lifecyclestatus?.ToLower() == "finalized")
            {
                try
                {
                    await PrintBillAsync(bill.Billid);
                }
                catch (Exception ex)
                {
                    printFailed = true;
                    printError = ex.Message;
                }
            }

            await SendTableStatusAsync(bill, orders);

            return Ok(new
            {
                status = "Success",
                message = printFailed ? $"Bill created successfully. Printing failed: {printError}" : "Bill created successfully and printed successfully.",
                billId = bill.Billid,
                printStatus = printFailed ? "Failed" : "Success"
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { status = "Error", message = ex.Message + ex.InnerException });
        }
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

            bool printFailed = false;
            string printError = "";
            if (request.Lifecyclestatus?.ToLower() == "printed" || request.Lifecyclestatus?.ToLower() == "finalized")
            {
                try
                {
                    await PrintBillAsync(bill.Billid);
                }
                catch (Exception ex)
                {
                    printFailed = true;
                    printError = ex.Message;
                }
            }

            await SendTableStatusAsync(bill, orders);

            return Ok(new
            {
                status = "Success",
                message = printFailed ? $"Bill updated successfully. Printing failed: {printError}" : "Bill updated successfully and printed successfully.",
                billId = bill.Billid,
                printStatus = printFailed ? "Failed" : "Success"
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
        var query = _context.Billheaders
            .OrderByDescending(b => b.Billid)
            .Include(b => b.Billdetails)
                .ThenInclude(d => d.Order)
                    .ThenInclude(o => o.Orderdetails)
            .AsQueryable();

        var tenant = await _tenant.GetAsync();

        query = query.ForBranch(tenant, branchId);
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
            query = query.Where(b => b.Billdetails.Any(d =>
                _context.Ordertypes
                    .Where(o => (int?)o.Ordertypeid == d.Order.Ordertypeid)
                    .Select(o => o.Ordertypename.ToLower())
                    .FirstOrDefault() == orderType.ToLower()));
        }

        var list = await query.Select(b => new
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
            branch = _context.Branches
                .Where(i => (int?)i.Branchid == b.Branchid)
                .Select(i => i.Branchname)
                .FirstOrDefault(),
            createdby = _context.Users
                .Where(p => (int?)p.Userid == b.CreatedBy)
                .Select(m => m.Username)
                .FirstOrDefault(),
            Orders = b.Billdetails.Select(d => new
            {
                d.Orderid,
                d.Order.Ordernumber,
                d.Order.Timedate,
                Status = d.Order.Status,
                d.Order.Totalprice,
                d.Order.Tableid,
                d.Order.Waiterid,
                Customerid = d.Order.Customerid,
                d.Order.Ordertypeid,
                OrderType = _context.Ordertypes
                    .Where(x => (int?)x.Ordertypeid == d.Order.Ordertypeid)
                    .Select(x => x.Ordertypename)
                    .FirstOrDefault(),
                OrderDetails = d.Order.Orderdetails.Select(od => new
                {
                    od.Orderdetailid,
                    od.Itemid,
                    Name = _context.Items
                        .Where(i => i.Itemid == od.Itemid)
                        .Select(i => i.Itemname)
                        .FirstOrDefault(),
                    od.Qty,
                    od.Price,
                    od.Sumofprice
                }).ToList()
            }).ToList()
        })
        .OrderByDescending(p => p.Datetime)
        .ThenByDescending(p => p.Billid)
        .ToListAsync();

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

        var billData = await query.Select(b => new
        {
            Orders = b.Billdetails.Select(d => new
            {
                d.Order.Totalprice,
                d.Order.Ordertypeid,
                d.Order.Status,
                d.Order.ComplimentaryF,
                OrderTypeName = _context.Ordertypes
                    .Where(x => (int?)x.Ordertypeid == d.Order.Ordertypeid)
                    .Select(x => x.Ordertypename)
                    .FirstOrDefault(),
                BillAmount = b.Subtotal ?? 0m,
                Tax = b.Tax ?? 0m
            }).ToList()
        }).ToListAsync();

        if (!billData.Any())
        {
            return Ok(new { status = "Success", message = "No bills found", data = (object)null });
        }

        var allOrders = billData.SelectMany(b => b.Orders).ToList();

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

    // Loads everything the bill needs, then prints it through the print queue (never on the request
    // thread). Throws when printing failed; a bill still printing after PrinterSettings:WaitSeconds
    // counts as printed and finishes in the background.
    private async Task PrintBillAsync(int billId)
    {
        var bill = await _context.Billheaders.AsNoTracking()
            .Include(x => x.Billdetails)
                .ThenInclude(d => d.Order)
                    .ThenInclude(o => o.Orderdetails)
            .FirstOrDefaultAsync(x => x.Billid == billId);

        if (bill == null) return;

        string hotelName = _configuration["RestaurantSettings:HotelName"] ?? "RESTAURANT";
        string hotelDescription = _configuration["RestaurantSettings:HotelDescription"] ?? "";
        string cashierName = await _context.Users
            .Where(u => (int?)u.Userid == bill.CreatedBy)
            .Select(u => u.Username)
            .FirstOrDefaultAsync() ?? "Admin";

        // Order type
        string orderTypeName = await _context.Billdetails
            .Where(d => d.Billid == bill.Billid)
            .Select(d => _context.Ordertypes
                .Where(x => (int?)x.Ordertypeid == d.Order.Ordertypeid)
                .Select(x => x.Ordertypename)
                .FirstOrDefault())
            .FirstOrDefaultAsync() ?? "TAKEAWAY";

        // Items grouped by itemid
        var billItemIds = bill.Billdetails
            .SelectMany(d => d.Order?.Orderdetails ?? new List<Orderdetail>())
            .Select(od => od.Itemid).Distinct().ToList();
        var itemNames = await _context.Items.AsNoTracking()
            .Where(i => billItemIds.Contains(i.Itemid))
            .Select(i => new { i.Itemid, i.Itemname })
            .ToDictionaryAsync(i => i.Itemid, i => i.Itemname);
        var items = bill.Billdetails
            .SelectMany(d => d.Order?.Orderdetails ?? new List<Orderdetail>())
            .GroupBy(od => od.Itemid)
            .Select(gp => new
            {
                ItemName = itemNames.GetValueOrDefault(gp.Key) ?? "Unknown Item",
                Price = gp.FirstOrDefault().Price,
                Qty = gp.Sum(x => x.Qty),
                SubTotal = gp.Sum(x => x.Sumofprice)
            })
            .ToList();

        var job = _printQueue.Enqueue(_configuration["PrinterSettings:BillPrinter"], graphics =>
        {
            float y = 10f;
            float left = 10f;
            float width = 263f;

            Font headerFont = new Font("Courier New", 12f, FontStyle.Bold);
            Font normalFont = new Font("Courier New", 9f, FontStyle.Regular);
            Font boldFont = new Font("Courier New", 9f, FontStyle.Bold);

            var centerFormat = new StringFormat { Alignment = StringAlignment.Center };
            var rightFormat = new StringFormat { Alignment = StringAlignment.Far };

            // Hotel name
            graphics.DrawString(hotelName, headerFont, Brushes.Black, new RectangleF(left, y, width, 40f), centerFormat);
            y += 20f;

            // Hotel description
            if (!string.IsNullOrEmpty(hotelDescription))
            {
                SizeF descSize = graphics.MeasureString(hotelDescription, normalFont, (int)width);
                graphics.DrawString(hotelDescription, normalFont, Brushes.Black, new RectangleF(left, y, width, descSize.Height), centerFormat);
                y += descSize.Height + 10f;
            }

            // Bill number
            string billNo = bill.Billnumber.Contains("-") ? bill.Billnumber.Split('-').Last() : bill.Billnumber;
            graphics.DrawString("*** Bill No - " + billNo + " ***", boldFont, Brushes.Black, new RectangleF(left, y, width, 15f), centerFormat);
            y += 15f;

            // Token number
            graphics.DrawString($"Token No#:{bill.Billid}", boldFont, Brushes.Black, new RectangleF(left, y, width, 15f), centerFormat);
            y += 15f;

            // Order type
            graphics.DrawString(orderTypeName.ToUpper(), boldFont, Brushes.Black, new RectangleF(left, y, width, 15f), centerFormat);
            y += 15f;

            // Cashier
            graphics.DrawString("Cashier# " + cashierName, normalFont, Brushes.Black, left, y);
            y += 15f;

            // Date
            graphics.DrawString($"Date : {bill.Datetime:dd/MM/yyyy hh:mm tt}", normalFont, Brushes.Black, left, y);
            y += 20f;

            // Separator
            string separator = new string('-', 37);
            graphics.DrawString(separator, normalFont, Brushes.Black, left, y);
            y += 12f;

            // Column headers
            graphics.DrawString("ITEM NAME", boldFont, Brushes.Black, left, y);
            graphics.DrawString("PRICE", boldFont, Brushes.Black, left + 130f, y);
            graphics.DrawString("QTY", boldFont, Brushes.Black, left + 185f, y);
            graphics.DrawString("SUB", boldFont, Brushes.Black, left + width, y, rightFormat);
            y += 15f;

            graphics.DrawString(separator, normalFont, Brushes.Black, left, y);
            y += 12f;

            // Items grouped by itemid
            int itemCount = 0;
            decimal totalQty = 0;

            float nameWidth = 120f;
            foreach (var item in items)
            {
                if (item.Qty > 0)
                {
                    SizeF nameSize = graphics.MeasureString(item.ItemName, boldFont, (int)nameWidth);
                    graphics.DrawString(item.ItemName, boldFont, Brushes.Black, new RectangleF(left, y, nameWidth, nameSize.Height));
                    graphics.DrawString($"{item.Price:F2}", normalFont, Brushes.Black, left + 130f, y);
                    graphics.DrawString($"{item.Qty}", normalFont, Brushes.Black, left + 185f, y);
                    graphics.DrawString($"{item.SubTotal:F2}", normalFont, Brushes.Black, left + width, y, rightFormat);
                    y += nameSize.Height + 3f;
                    itemCount++;
                    totalQty += (decimal)item.Qty;
                }
            }

            // Totals
            graphics.DrawString(separator, normalFont, Brushes.Black, left, y);
            y += 12f;

            graphics.DrawString("Sub Total RS", normalFont, Brushes.Black, left + 60f, y);
            graphics.DrawString($"{bill.Subtotal:F2}", normalFont, Brushes.Black, left + width, y, rightFormat);
            y += 15f;

            decimal taxRate = 2.500m;
            decimal halfTax = bill.Tax.GetValueOrDefault() / 2m;
            graphics.DrawString($"CGST:{taxRate:F3}%", normalFont, Brushes.Black, left + 60f, y);
            graphics.DrawString($"{halfTax:F2}", normalFont, Brushes.Black, left + width, y, rightFormat);
            y += 15f;

            graphics.DrawString($"SGST:{taxRate:F3}%", normalFont, Brushes.Black, left + 60f, y);
            graphics.DrawString($"{halfTax:F2}", normalFont, Brushes.Black, left + width, y, rightFormat);
            y += 15f;

            decimal subtotalPlusTax = bill.Subtotal.GetValueOrDefault() + bill.Tax.GetValueOrDefault();
            decimal total = bill.Totalamount ?? decimal.Round(subtotalPlusTax, 0);
            decimal roundOff = total - subtotalPlusTax;
            graphics.DrawString("Round Off", normalFont, Brushes.Black, left + 60f, y);
            graphics.DrawString($"{roundOff:F2}", normalFont, Brushes.Black, left + width, y, rightFormat);
            y += 15f;

            graphics.DrawString(separator, normalFont, Brushes.Black, left, y);
            y += 12f;

            graphics.DrawString("Total RS", headerFont, Brushes.Black, left + 40f, y);
            graphics.DrawString($"{total:F2}", headerFont, Brushes.Black, left + width, y, rightFormat);
            y += 25f;

            graphics.DrawString($"Total Items - {itemCount}, Qty - {totalQty:G0}", normalFont, Brushes.Black, left, y);
            y += 15f;

            graphics.DrawString("Settlement Type : " + bill.Paymentmode, normalFont, Brushes.Black, left, y);
            y += 20f;

            graphics.DrawString(separator, normalFont, Brushes.Black, left, y);
        });

        string? outcome = (await _printQueue.WaitAsync(new[] { job }))[0];
        if (!string.IsNullOrEmpty(outcome))
            throw new Exception(outcome);
    }
}
