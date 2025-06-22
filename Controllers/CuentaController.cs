// Controllers/AccountController.cs
using Microsoft.AspNetCore.Mvc;

namespace VehiculosDGA.Controllers
{
    public class CuentaController : Controller
    {
        public IActionResult Registro()
        {
            return View();
        }
         public IActionResult Login()
        {
            return View();
        }

        public IActionResult ForgotPassword()
        {
            return View();
        }

        public IActionResult ResetPassword()
        {
            return View();
        }
    }
}