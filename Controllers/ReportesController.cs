using Microsoft.AspNetCore.Mvc;

namespace VehiculosDGA.Web.Controllers
{
    public class ReportesController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
