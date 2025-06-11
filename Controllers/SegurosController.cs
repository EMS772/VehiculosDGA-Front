using Microsoft.AspNetCore.Mvc;

namespace VehiculosDGA.Web.Controllers
{
    public class SegurosController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
