using Microsoft.AspNetCore.Mvc;

namespace AqrabMakinaLeek.WebApi.Controllers;

[ApiController]
public class HealthController : ControllerBase
{
    [HttpGet("health")]
    [HttpGet("v1/health")]
    public IActionResult Health()
    {
        return Ok(new
        {
            status = "ok",
            timestamp = DateTime.UtcNow.ToString("o")
        });
    }
}
