//namespace FoodApiService.Service;

//public class DateHelper
//{
//    public static DateTime GetBusinessDate(DateTime dateTime)
//    {
//        DateTime localTime = dateTime.ToLocalTime();
//        TimeSpan cutoff = new TimeSpan(11, 0, 0);
//        if (localTime.TimeOfDay < cutoff)
//        {
//            return localTime.Date.AddDays(-1.0);
//        }
//        return localTime.Date;
//    }
//}
namespace FoodApiService.Service;

public class DateHelper
{
    public static DateTime GetBusinessDate(DateTime dateTime)
    {
        return dateTime.ToLocalTime().Date;
    }
}