const launcher = `@echo off
where msedge >nul 2>&1 && start "" msedge --app=https://erp.aetherbi.com/dashboard && exit /b 0
where chrome >nul 2>&1 && start "" chrome --app=https://erp.aetherbi.com/dashboard && exit /b 0
start "" https://erp.aetherbi.com/dashboard
`;

export async function GET() {
  return new Response(launcher, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="AetherBI-ERP-Desktop.bat"',
    },
  });
}
