const { app, BrowserWindow, Menu, globalShortcut } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const root = path.join(__dirname, "..");
const home = "http://localhost:3000";
let server;

function ping() {
  return new Promise((resolve) => {
    const request = http.get(`${home}/login`, (response) => {
      response.resume();
      resolve(response.statusCode && response.statusCode < 500);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  if (await ping()) return;
  server = spawn("npm", ["run", "dev"], { cwd: root, shell: true, windowsHide: true, stdio: "ignore" });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await ping()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

function focusSearch(win) {
  win.webContents.executeJavaScript("document.getElementById('pos-search')?.focus()").catch(() => undefined);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "AetherBI ERP",
    autoHideMenuBar: false,
    backgroundColor: "#0f172a",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  const template = [
    {
      label: "AetherBI",
      submenu: [
        { label: "نقطة البيع", click: () => win.loadURL(`${home}/pos`) },
        { label: "فاتورة جديدة", accelerator: "F1", click: () => win.loadURL(`${home}/sales`) },
        { label: "بحث صنف", accelerator: "F2", click: () => win.loadURL(`${home}/pos`).then(() => focusSearch(win)) },
        { label: "طباعة الإيصال", accelerator: "CmdOrCtrl+P", click: () => win.webContents.print() },
        { type: "separator" },
        { label: "إعادة تحميل", role: "reload" },
        { label: "خروج", role: "quit" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  win.loadURL(`${home}/dashboard`);
  globalShortcut.register("F1", () => win.loadURL(`${home}/sales`));
  globalShortcut.register("F2", () => {
    win.loadURL(`${home}/pos`);
    win.webContents.once("did-finish-load", () => focusSearch(win));
  });
  globalShortcut.register("CommandOrControl+P", () => win.webContents.print());
  win.on("closed", () => globalShortcut.unregisterAll());
}

app.whenReady().then(async () => {
  await ensureServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (server) server.kill();
  app.quit();
});
