import { Component } from "@angular/core";

export const appSetttings = 'http://localhost:81/Resto/api/';
export const customSignalrUrl = 'http://192.168.1.6:100/Resto/kotHub';
export const taxInclusive = true;
export const isLoading =false;
export const categoryList ={
   Categories :[
        {
            CategoryId:1,
            CategoryName:'Tea Powder',
            IsActive:true
        },
        {
            CategoryId:2,
            CategoryName:'Tea Powder',
            IsActive:true
        }
    ]
}


export const customerList ={
  "status": "success",
  "message": "Customers retrieved successfully",
  "customers": [
    {
      "id": 12345,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+1-555-555-5555"
    },
    {
      "id": 12346,
      "first_name": "Johnny",
      "last_name": "Appleseed",
      "email": "johnny.appleseed@example.com",
      "phone": "+1-555-555-6666"
    },
    {
      "id": 12347,
      "first_name": "Jonathan",
      "last_name": "Smith",
      "email": "jonathan.smith@example.com",
      "phone": "+1-555-555-7777"
    }
  ]
}



export const waiterList ={
  "status": "success",
  "message": "Waiters retrieved successfully",
  "waiters": [
    {
      "id": 1,
      "first_name": "Alice",
      "last_name": "Johnson",
      "email": "alice.johnson@example.com",
      "phone": "+1-555-123-4567",
      "status": "active",
      "shift": "morning"
    },
    {
      "id": 2,
      "first_name": "Bob",
      "last_name": "Smith",
      "email": "bob.smith@example.com",
      "phone": "+1-555-234-5678",
      "status": "active",
      "shift": "evening"
    },
    {
      "id": 3,
      "first_name": "Charlie",
      "last_name": "Brown",
      "email": "charlie.brown@example.com",
      "phone": "+1-555-345-6789",
      "status": "inactive",
      "shift": "night"
    }
  ]
}

export const productList={
    date: "2024-07-22",
    billno: "123456",
    items: [
      {
        s_no: 1,
        qrcodeid: "QR123456",
        productid: "P123456",
        productname: "Product Name 1",
        quantity: 10,
        mrp: 100.00,
        discount: 10.00,
        actual_price: 90.00,
        selling_price: 85.00
      },
      {
        s_no: 2,
        qrcodeid: "QR123457",
        productid: "P123457",
        productname: "Product Name 2",
        quantity: 5,
        mrp: 200.00,
        discount: 20.00,
        actual_price: 180.00,
        selling_price: 175.00
      },
      {
        s_no: 3,
        qrcodeid: "QR123458",
        productid: "P123458",
        productname: "Product Name 3",
        quantity: 20,
        mrp: 50.00,
        discount: 5.00,
        actual_price: 45.00,
        selling_price: 42.50
      },
      {
        s_no: 4,
        qrcodeid: "QR123459",
        productid: "P123459",
        productname: "Product Name 4",
        quantity: 15,
        mrp: 150.00,
        discount: 15.00,
        actual_price: 135.00,
        selling_price: 130.00
      }
    ],
}  


export const checkLogin ={
  status: "success",
  message: "Login successful",
  token: "eyJhbGciOiJIUzI1NiIsInR5...",
  user: {
    roles: ["admin", "editor"]
  }  
}


export const menuList ={
  status: "success",
  message: "Login successful",
  user: {
    id: 101,
    name: "John Doe",
    email: "john.doe@example.com"
  }, 
  menu: [
    {
      name: "Dine in",
      url: "/dinein",
      icon: "pi pi-calendar-plus icon",
      submenu: []
    },
    {
      name: "Take away",
      url: "/take-away",
      icon: "pi pi-shop icon",
      submenu: []
    },
    {
      name: "Home Delivery",
      url: "/home-delivery",
      icon: "pi pi-shop icon",
      submenu: []
    },
        {
      name: "Report",
      url: "/dashboard",
      icon: "pi pi-chart-bar icon",
      submenu: []
    },
       {
      name: "Master",
      url: "/master",
      icon: "pi pi-cog  icon",
      submenu: [
        {
          name: "Branch",
          url: "/branch",
          icon: "user"
        },
       {
          name: "Users",
          url: "/users",
          icon: "user"
        },
        {
          name: "Floors",
          url: "/floors",
          icon: "user"
        },
        {
          name: "Tables",
          url: "/tables",
          icon: "user"
        },
        {
          name: "Categories",
          url: "/categories",
          icon: "user"
        },
        {
          name: "Customers",
          url: "/customers",
          icon: "preferences"
        },
        {
          name: "Waiter",
          url: "/waiter",
          icon: "preferences"
        },
        {
          name: "Menu List",
          url: "/menu-list",
          icon: "preferences"
        },
        {
          name: "Menu Type",
          url: "/menu-type",
          icon: "preferences"
        },
        {
          name: "Orders",
          url: "/order-histroy",
          icon: "preferences"
        },
        {
          name: "Orders Type",
          url: "/order-type",
          icon: "preferences"
        },
        {
          name: "Tax",
          url: "/tax",
          icon: "preferences"
        },
        {
          name: "Discount",
          url: "/discount",
          icon: "preferences"
        },
        {
          name: "Extra Charge",
          url: "/extra-charge",
          icon: "preferences"
        }
      ]
    },
    {
      name: "Settings",
      url: "/settings",
      icon: "pi pi-cog  icon",
      submenu: [
        {

          name: "Profile",
          url: "/settings/profile",
          icon: "user"
        },
        {
          name: "Logout",
          url: "/logout",
          icon: "preferences"
        }
      ]
    }
  ]
}


export const dinein = {
  status: "success",
  message: "Dine-in details fetched successfully",
  floors: [
    {
      id: 1,
      name: "Ground Floor",
      tables: [
        {
          id: 101,
          number: "G1",
          capacity: 4,
          status: "available"
        },
        {
          id: 102,
          number: "G2",
          capacity: 6,
          status: "occupied",
          flag:false,
          occupied_by: [{
            reservation_id: 201,
            customer_name: "John Doe",
            start_time: "2024-09-15T12:30:00"
          },{
            reservation_id: 202,
            customer_name: "Ameer Shirajudeen",
            start_time: "2024-09-15T12:30:00"
          },{
            reservation_id: 203,
            customer_name: "Ameer Shirajudeen",
            start_time: "2024-09-15T12:30:00"
          }]
        },
        {
          id: 103,
          number: "G3",
          capacity: 2,
          status: "available"
        }
      ]
    },
    {
      id: 2,
      "name": "First Floor",
      "tables": [
        {
          id: 201,
          number: "F1",
          capacity: 4,
          status: "available"
        },
        {
          id: 202,
          number: "F2",
          capacity: 8,
          status: "occupied",
          flag:false,
          occupied_by : [{
            reservation_id: 202,
            customer_name: "Jane Smith",
            start_time: "2024-09-15T13:00:00"
          }]
        }
      ]
    }
  ]
}


export const restaurants  = {
  "status": "success",
  "message": "Food menu retrieved successfully",
  "hotel": {
    "id": 101,
    "name": "The Grand Hotel",
    "location": "Downtown, City"
  },
  "menu": [
        {
          "id": 101,
          "name": "Veg Starters",
          "flag" :false,
          "orderDetail": [
            {
              "itemID": 1,
              "name":"Spring Rolls",
              "qty": 1,
              "price": 5.99,
              "sumOfPrice":5.99,
            },
            {
              "itemID": 2,
              "name":"Veg Biriyani",
              "qty": 1,
              "price": 20,
              "sumOfPrice":20,
            },
            {
              "itemID": 3,
              "name":"Mutton Biriyani",
              "qty": 1,
              "price": 200,
              "sumOfPrice":200,
            }
          ]
        },
        {
          "id": 102,
          "name": "Non-Veg Starters",
          "flag" :false,
          "orderDetail": [
            {
              "itemID": 6,
              "name": "Chicken Wings",
              "price": 8.99,
              "qty": 1,
              "sumOfPrice":8.99,
            },
            {
              "itemID": 8,
              "name": "Fish Fingers",
              "price": 9.99,
              "qty": 1,
              "sumOfPrice":9.99,
            }
          ]
        },
                {
          "id": 103,
          "name": "Veg Main Course",
          "flag" :false,
          "orderDetail": [
            {
              "itemID": 1005,
              "name": "Paneer Butter Masala",
              "price": 12.99,
              "qty": 1,
              "sumOfPrice":12.99,
            },
            {
              "itemID": 1007,
              "name": "Vegetable Biryani",
              "price": 10.99,
              "qty": 1,
              "sumOfPrice":10.99,
            }
          ]
        },
        {
          "id": 104,
          "name": "Non-Veg Main Course",
          "flag" :false,
          "orderDetail": [
            {
              "itemID": 1211,
              "name": "Mutton Butter Masala",
              "price": 12.99,
              "qty": 1,
              "sumOfPrice":12.99,
            },
            {
              "itemID": 1321,
              "name": "Veg Biryani",
              "price": 10.99,
              "qty": 1,
              "sumOfPrice":10.99,
            }
          ]
        }
      ]
}
