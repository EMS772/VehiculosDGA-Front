using Microsoft.AspNetCore.Mvc;

namespace VehiculosDGA.Web.Controllers
{
    public class VehiculosController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
