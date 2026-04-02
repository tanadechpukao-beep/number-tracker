using System;
using System.IO;
using System.Text;

class Program {
    static void Main() {
        // Read HTML
        string html = File.ReadAllText("index.html");
        string b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(html));
        
        // Create standalone HTML with base64-encoded content
        string wrapper = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>กรมเกษตรธิการ</title></head><body onload=\"document.body.innerHTML=atob('" + b64 + "')\"></body></html>";
        
        File.WriteAllText("standalone.html", wrapper);
        Console.WriteLine("✅ Built standalone.html (" + wrapper.Length + " bytes)");
    }
}
