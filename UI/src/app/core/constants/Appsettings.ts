import { Component } from "@angular/core";

export const appSetttings ='http://localhost:100/Resto/api/';

export class AppSettings {
  static apiUrl = '';
    static signalrUrl = '';
    static appName = '';
    static appDescription = '';
    static appLogo = '';
    static version = '';
    static taxInclusive = true;
}

// export const isLoading =false;

export const menuList ={
  status: "success",
  message: "menu successful",
  menu: [
    {
      name: "Dine in",
      url: "/dinein",
      icon: "pi pi-calendar-plus icon",
      submenu: []
    },
    {
      name: "Take away",
      url: "/order/0/0/2",
      icon: "pi pi-shop icon",
      submenu: []
    },
    {
      name: "Home Delivery",
      url: "/order/0/0/3",
      icon: "pi pi-shop icon",
      submenu: []
    },
    {
      name: "Waitlist",
      url: "/waitlist",
      icon: "pi pi-users icon",
      submenu: [
        {
          name: "Waitlist & Tables",
          url: "/waitlist",
          icon: ""
        },
        {
          name: "Token Booking",
          url: "/token-booking",
          icon: ""
        }
      ]
    },
        {
      name: "Report",
      url: "/dashboard",
      icon: "pi pi-chart-bar icon",
       submenu: [        
        {
          name: "Sales Report",
          url: "/sales-report",
          icon: ""
        },
        {
          name: "Item wise Report",
          url: "/item-wise-report",
          icon: ""
        },
         {
          name: "Order Report",
          url: "/order-report",
          icon: "preferences"
        },
        {
          name: "Captain wise Report",
          url: "/captain-wise-report",
          icon: ""
        },
        {
          name: "Customer wise Report",
          url: "/customer-wise-report",
          icon: ""
        },{
          name: "Payment mode wise Report",
          url: "/payment-mode-wise-report",
          icon: ""
        },{
          name: "Complementary Report",
          url: "/complementary-report",
          icon: ""
        }
      ]
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
          name: "Kitchens",
          url: "/kitchens",
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


export const captainMenuList ={
  status: "success",
  message: "menu successful",
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
      name: "Waitlist",
      url: "/waitlist",
      icon: "pi pi-users icon",
      submenu: [
        {
          name: "Waitlist & Tables",
          url: "/waitlist",
          icon: ""
        },
        {
          name: "Token Booking",
          url: "/token-booking",
          icon: ""
        }
      ]
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
          name: "Customers",
          url: "/customers",
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
          name: "My Orders",
          url: "/order-histroy",
          icon: "preferences"
        },
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


export const chefMenuList ={
  status: "success",
  message: "menu successful",
  menu: [
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
          name: "Customers",
          url: "/customers",
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
          name: "My Orders",
          url: "/order-histroy",
          icon: "preferences"
        },
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