namespace FoodApiService.Service.Sync;

// Online server (Sync:Mode Cloud) is view only: every request that would change data is refused.
// Changes are made on the branch server and reach the online server with its next upload.
public static class ReadOnlyGuard
{
    // The only non-GET requests the online server takes: signing in, branch uploads, the owner's WhatsApp
    // report (reads data, sends a message) and the SignalR handshake.
    private static readonly string[] Allowed =
    [
        "/api/auth/login",
        "/api/Sync/Ingest",
        "/api/OwnerReport/Preview",
        "/api/OwnerReport/Send",
        "/kotHub",
    ];

    public static IApplicationBuilder UseCloudReadOnly(this IApplicationBuilder app, SyncSettings settings)
    {
        if (!settings.IsCloud)
            return app;

        return app.Use(async (context, next) =>
        {
            var method = context.Request.Method;
            bool reads = HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method);
            string path = context.Request.Path.Value ?? "";
            if (reads || Allowed.Any(a => path.StartsWith(a, StringComparison.OrdinalIgnoreCase)))
            {
                await next();
                return;
            }

            context.Response.StatusCode = StatusCodes.Status409Conflict;
            await context.Response.WriteAsJsonAsync(new
            {
                status = "Error",
                message = "This is the online view: it is read only. Make changes on the branch server."
            });
        });
    }
}
