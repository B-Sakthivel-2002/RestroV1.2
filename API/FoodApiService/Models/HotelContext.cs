using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Models;

public class HotelContext : DbContext
{
    public virtual DbSet<Billdetail> Billdetails { get; set; }
    public virtual DbSet<Billheader> Billheaders { get; set; }
    public virtual DbSet<Branch> Branches { get; set; }
    public virtual DbSet<Category> Categories { get; set; }
    public virtual DbSet<Choice> Choices { get; set; }
    public virtual DbSet<Customer> Customers { get; set; }
    public virtual DbSet<DocSequence> DocSequences { get; set; }
    public virtual DbSet<Discount> Discounts { get; set; }
    public virtual DbSet<Extracharge> Extracharges { get; set; }
    public virtual DbSet<Floor> Floors { get; set; }
    public virtual DbSet<Item> Items { get; set; }
    public virtual DbSet<Kitchen> Kitchens { get; set; }
    public virtual DbSet<Itemchoice> Itemchoices { get; set; }
    public virtual DbSet<Mealtype> Mealtypes { get; set; }
    public virtual DbSet<Order> Orders { get; set; }
    public virtual DbSet<Orderdetail> Orderdetails { get; set; }
    public virtual DbSet<Ordertype> Ordertypes { get; set; }
    public virtual DbSet<Outlet> Outlets { get; set; }
    public virtual DbSet<Role> Roles { get; set; }
    public virtual DbSet<Table> Tables { get; set; }
    public virtual DbSet<Tablebooking> Tablebookings { get; set; }
    public virtual DbSet<TableHistory> TableHistories { get; set; }
    public virtual DbSet<Tax> Taxes { get; set; }
    public virtual DbSet<Timeslot> Timeslots { get; set; }
    public virtual DbSet<User> Users { get; set; }
    public virtual DbSet<Userrole> Userroles { get; set; }
    public virtual DbSet<WaitlistToken> WaitlistTokens { get; set; }
    public virtual DbSet<Waiter> Waiters { get; set; }
    public virtual DbSet<Workperiod> Workperiods { get; set; }

    public HotelContext()
    {
    }

    public HotelContext(DbContextOptions<HotelContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Billdetail>(entity =>
        {
            entity.HasKey(e => e.Billdetailid).HasName("billdetail_pkey");
            entity.ToTable("billdetail");
            entity.Property(e => e.Billdetailid).HasColumnName("billdetailid");
            entity.Property(e => e.Billid).HasColumnName("billid");
            entity.Property(e => e.Discountid).HasColumnName("discountid");
            entity.Property(e => e.Extraamountid).HasColumnName("extraamountid");
            entity.Property(e => e.Orderid).HasColumnName("orderid");
            entity.Property(e => e.Taxid).HasColumnName("taxid");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
            entity.HasOne(d => d.Bill).WithMany(p => p.Billdetails).HasForeignKey(d => d.Billid).HasConstraintName("fk_bill");
            entity.HasOne(d => d.Order).WithMany(p => p.Billdetails).HasForeignKey(d => d.Orderid).HasConstraintName("fk_order");
        });

        modelBuilder.Entity<Billheader>(entity =>
        {
            entity.HasKey(e => e.Billid).HasName("billheader_pkey");
            entity.ToTable("billheader");
            entity.Property(e => e.Billid).HasColumnName("billid");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.Billname).HasMaxLength(100).HasColumnName("billname");
            entity.Property(e => e.Billnumber).HasMaxLength(50).HasColumnName("billnumber");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Businessdate).HasColumnType("timestamp without time zone").HasColumnName("businessdate");
            entity.Property(e => e.Complementaryreason).HasMaxLength(500).HasColumnName("complementaryreason");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.Customerid).HasColumnName("customerid");
            entity.Property(e => e.Datetime).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("timestamp without time zone").HasColumnName("datetime");
            entity.Property(e => e.Discount).HasPrecision(10, 2).HasDefaultValueSql("0").HasColumnName("discount");
            entity.Property(e => e.Discountid).HasColumnName("discountid");
            entity.Property(e => e.Extraamount).HasPrecision(10, 2).HasDefaultValueSql("0").HasColumnName("extraamount");
            entity.Property(e => e.Gstin).HasMaxLength(15).HasColumnName("gstin");
            entity.Property(e => e.Iscomplementary).HasColumnName("iscomplementary");
            entity.Property(e => e.Lifecyclestatus).HasMaxLength(100).HasColumnName("lifecyclestatus");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.Paidamount).HasPrecision(18, 2).HasColumnName("paidamount");
            entity.Property(e => e.Paymentmode).HasMaxLength(100).HasColumnName("paymentmode");
            entity.Property(e => e.Phone).HasMaxLength(15).HasColumnName("phone");
            entity.Property(e => e.Status).HasMaxLength(100).HasColumnName("status");
            entity.Property(e => e.Subtotal).HasPrecision(10, 2).HasDefaultValueSql("0").HasColumnName("subtotal");
            entity.Property(e => e.Tax).HasPrecision(10, 2).HasDefaultValueSql("0").HasColumnName("tax");
            entity.Property(e => e.Taxid).HasColumnName("taxid");
            entity.Property(e => e.Totalamount).HasPrecision(10, 2).HasDefaultValueSql("0").HasColumnName("totalamount");
            entity.Property(e => e.Updatedby).HasColumnName("updatedby");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Branch>(entity =>
        {
            entity.HasKey(e => e.Branchid).HasName("branch_pkey");
            entity.ToTable("branch");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Addressline1).HasColumnName("addressline1");
            entity.Property(e => e.Addressline2).HasColumnName("addressline2");
            entity.Property(e => e.Branchname).HasMaxLength(100).HasColumnName("branchname");
            entity.Property(e => e.City).HasMaxLength(100).HasColumnName("city");
            entity.Property(e => e.Country).HasMaxLength(100).HasColumnName("country");
            entity.Property(e => e.Email).HasMaxLength(100).HasColumnName("email");
            entity.Property(e => e.Phone1).HasMaxLength(15).HasColumnName("phone1");
            entity.Property(e => e.Phone2).HasMaxLength(15).HasColumnName("phone2");
            entity.Property(e => e.Website).HasMaxLength(100).HasColumnName("website");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
            entity.Property(e => e.Code).HasMaxLength(20).HasColumnName("code");
            entity.HasOne(d => d.Outlet).WithMany(p => p.Branches).HasForeignKey(d => d.Outletid).HasConstraintName("fk_branch_outlet");
        });

        modelBuilder.Entity<Outlet>(entity =>
        {
            entity.HasKey(e => e.Outletid).HasName("outlet_pkey");
            entity.ToTable("outlet");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
            entity.Property(e => e.Outletname).HasMaxLength(100).HasColumnName("outletname");
            entity.Property(e => e.Code).HasMaxLength(20).HasColumnName("code");
            entity.Property(e => e.Phone).HasMaxLength(15).HasColumnName("phone");
            entity.Property(e => e.Email).HasMaxLength(100).HasColumnName("email");
            entity.Property(e => e.Status).HasDefaultValueSql("true").HasColumnName("status");
        });

        modelBuilder.Entity<DocSequence>(entity =>
        {
            entity.HasKey(e => new { e.Branchid, e.Doctype, e.Bizdate }).HasName("doc_sequence_pkey");
            entity.ToTable("doc_sequence");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Doctype).HasMaxLength(10).HasColumnName("doctype");
            entity.Property(e => e.Bizdate).HasColumnName("bizdate");
            entity.Property(e => e.Lastvalue).HasColumnName("lastvalue");
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.Categoryid).HasName("categories_pkey");
            entity.ToTable("categories");
            entity.Property(e => e.Categoryid).HasColumnName("categoryid");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Categoryname).HasMaxLength(100).HasColumnName("categoryname");
            entity.Property(e => e.Flag).HasColumnName("flag");
            entity.Property(e => e.Expressstall).HasColumnName("expressstall");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Choice>(entity =>
        {
            entity.HasKey(e => e.Choiceid).HasName("choice_pkey");
            entity.ToTable("choice");
            entity.Property(e => e.Choiceid).HasColumnName("choiceid");
            entity.Property(e => e.Additioncost).HasColumnName("additioncost");
            entity.Property(e => e.Choicename).HasMaxLength(100).HasColumnName("choicename");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Isfree).HasColumnName("isfree");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(e => e.Customerid).HasName("customers_pkey");
            entity.ToTable("customers");
            entity.Property(e => e.Customerid).HasColumnName("customerid");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.Contactnumber).HasMaxLength(15).HasColumnName("contactnumber");
            entity.Property(e => e.Email).HasMaxLength(100).HasColumnName("email");
            entity.Property(e => e.Name).HasMaxLength(100).HasColumnName("name");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Discount>(entity =>
        {
            entity.HasKey(e => e.Discountid).HasName("discount_pkey");
            entity.ToTable("discount");
            entity.Property(e => e.Discountid).HasColumnName("discountid");
            entity.Property(e => e.Discountfrom).HasPrecision(18, 2).HasColumnName("discountfrom");
            entity.Property(e => e.Discountname).HasMaxLength(100).HasColumnName("discountname");
            entity.Property(e => e.Discountrangestatus).HasColumnName("discountrangestatus");
            entity.Property(e => e.Discountrate).HasColumnName("discountrate");
            entity.Property(e => e.Discountto).HasPrecision(18, 2).HasColumnName("discountto");
            entity.Property(e => e.Discounttype).HasMaxLength(200).HasColumnName("discounttype");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Extracharge>(entity =>
        {
            entity.HasKey(e => e.Extrachargeid).HasName("extracharge_pkey");
            entity.ToTable("extracharge");
            entity.Property(e => e.Extrachargeid).UseIdentityAlwaysColumn().HasColumnName("extrachargeid");
            entity.Property(e => e.Extrachargefrom).HasPrecision(18, 2).HasColumnName("extrachargefrom");
            entity.Property(e => e.Extrachargename).HasMaxLength(100).HasColumnName("extrachargename");
            entity.Property(e => e.Extrachargerate).HasPrecision(18, 2).HasColumnName("extrachargerate");
            entity.Property(e => e.Extrachargestatus).HasColumnName("extrachargestatus");
            entity.Property(e => e.Extrachargeto).HasPrecision(18, 2).HasColumnName("extrachargeto");
            entity.Property(e => e.Extrachargetype).HasMaxLength(200).HasColumnName("extrachargetype");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
            entity.Property(e => e.Ordertypeid).HasColumnName("ordertypeid");
        });

        modelBuilder.Entity<Floor>(entity =>
        {
            entity.HasKey(e => e.Floorid).HasName("floor_pkey");
            entity.ToTable("floor");
            entity.Property(e => e.Floorid).HasColumnName("floorid");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Capacity).HasColumnName("capacity");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Floorname).HasMaxLength(100).HasColumnName("floorname");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.HasOne(d => d.Branch).WithMany(p => p.Floors).HasForeignKey(d => d.Branchid).HasConstraintName("fk_branch");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Item>(entity =>
        {
            entity.HasKey(e => e.Itemid).HasName("item_pkey");
            entity.ToTable("item");
            entity.Property(e => e.Itemid).HasColumnName("itemid");
            entity.Property(e => e.Categoryid).HasColumnName("categoryid");
            entity.Property(e => e.Code).HasMaxLength(100).HasColumnName("code");
            entity.Property(e => e.Defaultprice).HasColumnName("defaultprice");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Itemname).HasMaxLength(100).HasColumnName("itemname");
            entity.Property(e => e.Qty).HasColumnName("qty");
            entity.Property(e => e.Active).HasDefaultValueSql("true").HasColumnName("active");
            entity.Property(e => e.Kitchenid).HasColumnName("kitchenid");
            entity.HasOne(d => d.Category).WithMany(p => p.Items).HasForeignKey(d => d.Categoryid).HasConstraintName("fk_category");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Itemchoice>(entity =>
        {
            entity.HasKey(e => e.Itemchoiceid).HasName("itemchoice_pkey");
            entity.ToTable("itemchoice");
            entity.Property(e => e.Itemchoiceid).HasColumnName("itemchoiceid");
            entity.Property(e => e.Choiceid).HasColumnName("choiceid");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Itemid).HasColumnName("itemid");
            entity.Property(e => e.Price).HasColumnName("price");
            entity.HasOne(d => d.Choice).WithMany(p => p.Itemchoices).HasForeignKey(d => d.Choiceid).HasConstraintName("fk_choice");
            entity.HasOne(d => d.Item).WithMany(p => p.Itemchoices).HasForeignKey(d => d.Itemid).HasConstraintName("fk_item");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Mealtype>(entity =>
        {
            entity.HasKey(e => e.Mealtypeid).HasName("mealtype_pkey");
            entity.ToTable("mealtype");
            entity.Property(e => e.Mealtypeid).HasColumnName("mealtypeid");
            entity.Property(e => e.Mealtypename).HasMaxLength(100).HasColumnName("mealtypename");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Orderid).HasName("Order_pkey");
            entity.ToTable("Order");
            entity.Property(e => e.Orderid).HasColumnName("orderid");
            entity.Property(e => e.Billingid).HasColumnName("billingid");
            entity.Property(e => e.Bookingid).HasColumnName("bookingid");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Businessdate).HasColumnType("timestamp without time zone").HasColumnName("businessdate");
            entity.Property(e => e.Comments).HasMaxLength(100).HasColumnName("comments");
            entity.Property(e => e.ComplimentaryF).HasColumnName("complimentary_f");
            entity.Property(e => e.Createdby).HasColumnName("createdby");
            entity.Property(e => e.Customerid).HasColumnName("customerid");
            entity.Property(e => e.Ordernumber).HasMaxLength(50).HasColumnName("ordernumber");
            entity.Property(e => e.Guestlabel).HasMaxLength(30).HasColumnName("guestlabel");
            entity.Property(e => e.Ordertypeid).HasColumnName("ordertypeid");
            entity.Property(e => e.Price).HasColumnName("price");
            entity.Property(e => e.PrintedF).HasColumnName("printed_f");
            entity.Property(e => e.Qty).HasColumnName("qty");
            entity.Property(e => e.Remarks).HasMaxLength(100).HasColumnName("remarks");
            entity.Property(e => e.Status).HasColumnType("character varying").HasColumnName("status");
            entity.Property(e => e.Tableid).HasColumnName("tableid");
            entity.Property(e => e.Timedate).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("timestamp without time zone").HasColumnName("timedate");
            entity.Property(e => e.Totalprice).HasColumnName("totalprice");
            entity.Property(e => e.Waiterid).HasColumnName("waiterid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Orderdetail>(entity =>
        {
            entity.HasKey(e => e.Orderdetailid).HasName("orderdetail_pkey");
            entity.ToTable("orderdetail");
            entity.Property(e => e.Orderdetailid).HasColumnName("orderdetailid");
            entity.Property(e => e.Itemid).HasColumnName("itemid");
            entity.Property(e => e.Orderid).HasColumnName("orderid");
            entity.Property(e => e.Price).HasPrecision(10, 2).HasColumnName("price");
            entity.Property(e => e.Qty).HasColumnName("qty");
            entity.Property(e => e.Sumofprice).HasColumnName("sumofprice");
            entity.HasOne(d => d.Order).WithMany(p => p.Orderdetails).HasForeignKey(d => d.Orderid).HasConstraintName("fk_order");
            entity.Property(e => e.KOTStatus).HasMaxLength(100).HasColumnName("KOTStatus").IsRequired(false);
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Ordertype>(entity =>
        {
            entity.HasKey(e => e.Ordertypeid).HasName("ordertype_pkey");
            entity.ToTable("ordertype");
            entity.Property(e => e.Ordertypeid).HasColumnName("ordertypeid");
            entity.Property(e => e.Ordertypename).HasMaxLength(100).HasColumnName("ordertypename");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Roleid).HasName("role_pkey");
            entity.ToTable("role");
            entity.Property(e => e.Roleid).HasColumnName("roleid");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Rolename).HasMaxLength(100).HasColumnName("rolename");
            entity.Property(e => e.Status).HasDefaultValueSql("true").HasColumnName("status");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Table>(entity =>
        {
            entity.HasKey(e => e.Tableid).HasName("Table_pkey");
            entity.ToTable("Table");
            entity.Property(e => e.Tableid).HasColumnName("tableid");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Floorid).HasColumnName("floorid");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Tablename).HasMaxLength(100).HasColumnName("tablename");
            entity.Property(e => e.Capacity).HasColumnName("capacity");
            entity.Property(e => e.Tablestate).HasMaxLength(20).HasColumnName("tablestate");
            entity.Property(e => e.Statesince).HasColumnType("timestamp without time zone").HasColumnName("statesince");
            entity.Property(e => e.Mergedinto).HasColumnName("mergedinto");
            entity.HasOne(d => d.Floor).WithMany(p => p.Tables).HasForeignKey(d => d.Floorid).HasConstraintName("fk_floor");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Tablebooking>(entity =>
        {
            entity.HasKey(e => e.Bookingid).HasName("tablebookings_pkey");
            entity.ToTable("tablebookings");
            entity.Property(e => e.Bookingid).HasColumnName("bookingid");
            entity.Property(e => e.Bookingdate).HasColumnType("timestamp without time zone").HasColumnName("bookingdate");
            entity.Property(e => e.Customerid).HasColumnName("customerid");
            entity.Property(e => e.Numberofguests).HasColumnName("numberofguests");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Tableid).HasColumnName("tableid");
            entity.Property(e => e.Timeslotid).HasColumnName("timeslotid");
            entity.HasOne(d => d.Table).WithMany(p => p.Tablebookings).HasForeignKey(d => d.Tableid).HasConstraintName("fk_table");
            entity.HasOne(d => d.Timeslot).WithMany(p => p.Tablebookings).HasForeignKey(d => d.Timeslotid).HasConstraintName("fk_timeslot");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Tax>(entity =>
        {
            entity.HasKey(e => e.Taxid).HasName("tax_pkey");
            entity.ToTable("tax");
            entity.Property(e => e.Taxid).HasColumnName("taxid");
            entity.Property(e => e.Taxfrom).HasPrecision(18, 2).HasColumnName("taxfrom");
            entity.Property(e => e.Taxname).HasMaxLength(100).HasColumnName("taxname");
            entity.Property(e => e.Taxrangestatus).HasColumnName("taxrangestatus");
            entity.Property(e => e.Taxrate).HasColumnName("taxrate");
            entity.Property(e => e.Taxto).HasPrecision(18, 2).HasColumnName("taxto");
            entity.Property(e => e.Taxtype).HasMaxLength(200).HasColumnName("taxtype");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Timeslot>(entity =>
        {
            entity.HasKey(e => e.Timeslotid).HasName("timeslots_pkey");
            entity.ToTable("timeslots");
            entity.Property(e => e.Timeslotid).HasColumnName("timeslotid");
            entity.Property(e => e.Endtime).HasColumnType("timestamp without time zone").HasColumnName("endtime");
            entity.Property(e => e.Starttime).HasColumnType("timestamp without time zone").HasColumnName("starttime");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Userid).HasName("login_pkey");
            entity.ToTable("user");
            entity.Property(e => e.Userid).HasDefaultValueSql("nextval('login_userid_seq'::regclass)").HasColumnName("userid");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Password).HasMaxLength(255).HasColumnName("password");
            entity.Property(e => e.Status).HasDefaultValueSql("true").HasColumnName("status");
            entity.Property(e => e.Username).HasMaxLength(100).HasColumnName("username");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Userrole>(entity =>
        {
            entity.HasKey(e => e.Userroleid).HasName("userroles_pkey");
            entity.ToTable("userroles");
            entity.Property(e => e.Userroleid).HasColumnName("userroleid");
            entity.Property(e => e.Roleid).HasColumnName("roleid");
            entity.Property(e => e.Userid).HasColumnName("userid");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Waiter>(entity =>
        {
            entity.HasKey(e => e.Waiterid).HasName("waiter_pkey");
            entity.ToTable("waiter");
            entity.Property(e => e.Waiterid).HasColumnName("waiterid");
            entity.Property(e => e.Contactnumber).HasMaxLength(15).HasColumnName("contactnumber");
            entity.Property(e => e.Datejoined).HasColumnName("datejoined");
            entity.Property(e => e.Shift).HasMaxLength(50).HasColumnName("shift");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Waitername).HasMaxLength(100).HasColumnName("waitername");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Workperiod>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("workperiods_pkey");
            entity.ToTable("workperiods");
            entity.Property(e => e.Id).UseIdentityAlwaysColumn().HasColumnName("id");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Closedat).HasColumnType("timestamp without time zone").HasColumnName("closedat");
            entity.Property(e => e.Closedby).HasColumnName("closedby");
            entity.Property(e => e.Date).HasColumnName("date");
            entity.Property(e => e.Openedat).HasColumnType("timestamp without time zone").HasColumnName("openedat");
            entity.Property(e => e.Openedby).HasColumnName("openedby");
            entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValueSql("'open'::character varying").HasColumnName("status");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<Kitchen>(entity =>
        {
            entity.HasKey(e => e.Kitchenid).HasName("kitchen_pkey");
            entity.ToTable("kitchen");
            entity.Property(e => e.Kitchenid).HasColumnName("kitchenid");
            entity.Property(e => e.Kitchenname).HasMaxLength(100).HasColumnName("kitchenname");
            entity.Property(e => e.Printername).HasMaxLength(200).HasColumnName("printername");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.Entity<WaitlistToken>(entity =>
        {
            entity.HasKey(e => e.Tokenid).HasName("waitlist_token_pkey");
            entity.ToTable("waitlist_token");
            entity.Property(e => e.Tokenid).HasColumnName("tokenid");
            entity.Property(e => e.Tokencode).HasMaxLength(20).HasColumnName("tokencode");
            entity.Property(e => e.Bizdate).HasColumnName("bizdate");
            entity.Property(e => e.Customername).HasMaxLength(100).HasColumnName("customername");
            entity.Property(e => e.Mobile).HasMaxLength(20).HasColumnName("mobile");
            entity.Property(e => e.Email).HasMaxLength(150).HasColumnName("email");
            entity.Property(e => e.Guests).HasColumnName("guests");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.Status).HasMaxLength(20).HasColumnName("status");
            entity.Property(e => e.Tableid).HasColumnName("tableid");
            entity.Property(e => e.Assignmode).HasMaxLength(10).HasColumnName("assignmode");
            entity.Property(e => e.Createdat).HasColumnType("timestamp without time zone").HasColumnName("createdat");
            entity.Property(e => e.Calledat).HasColumnType("timestamp without time zone").HasColumnName("calledat");
            entity.Property(e => e.Seatedat).HasColumnType("timestamp without time zone").HasColumnName("seatedat");
            entity.Property(e => e.Closedat).HasColumnType("timestamp without time zone").HasColumnName("closedat");
            entity.Property(e => e.Createdby).HasColumnName("createdby");
            entity.Property(e => e.Updatedby).HasColumnName("updatedby");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
            entity.HasOne(d => d.Table).WithMany().HasForeignKey(d => d.Tableid).OnDelete(DeleteBehavior.SetNull).HasConstraintName("fk_waitlist_token_table");
        });

        modelBuilder.Entity<TableHistory>(entity =>
        {
            entity.HasKey(e => e.Historyid).HasName("table_history_pkey");
            entity.ToTable("table_history");
            entity.Property(e => e.Historyid).HasColumnName("historyid");
            entity.Property(e => e.Tableid).HasColumnName("tableid");
            entity.Property(e => e.Event).HasMaxLength(30).HasColumnName("event");
            entity.Property(e => e.Fromstate).HasMaxLength(20).HasColumnName("fromstate");
            entity.Property(e => e.Tostate).HasMaxLength(20).HasColumnName("tostate");
            entity.Property(e => e.Relatedtableid).HasColumnName("relatedtableid");
            entity.Property(e => e.Tokenid).HasColumnName("tokenid");
            entity.Property(e => e.Orderid).HasColumnName("orderid");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.Userid).HasColumnName("userid");
            entity.Property(e => e.Createdat).HasColumnType("timestamp without time zone").HasColumnName("createdat");
            entity.Property(e => e.Branchid).HasColumnName("branchid");
            entity.Property(e => e.Outletid).HasColumnName("outletid");
        });

        modelBuilder.HasSequence("orderdetail_orderdetailid_seq");
    }
}
