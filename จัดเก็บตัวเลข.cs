using System;
using System.IO;
using System.Diagnostics;
using System.Text;

class App {
    static void Main() {
        try {
            // Embedded base64 HTML
            string b64html = File.ReadAllText("standalone.html");
            
            // Create temp HTML file
            string tempDir = Path.Combine(Path.GetTempPath(), "กรมนา");
            Directory.CreateDirectory(tempDir);
            string tempFile = Path.Combine(tempDir, "index.html");
            File.WriteAllText(tempFile, b64html);
            
            // Try Edge first, then Chrome, then default browser
            string[] browsers = {
                "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
                "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
            };
            
            bool launched = false;
            foreach (string browser in browsers) {
                if (File.Exists(browser)) {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = browser;
                    psi.Arguments = "--app=" + tempFile;
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                    launched = true;
                    break;
                }
            }
            
            if (!launched) {
                // Fall back to default browser
                ProcessStartInfo psi2 = new ProcessStartInfo();
                psi2.FileName = tempFile;
                psi2.UseShellExecute = true;
                Process.Start(psi2);
            }
        }
        catch (Exception ex) {
            Console.WriteLine("Error: " + ex.Message);
        }
    }
}
