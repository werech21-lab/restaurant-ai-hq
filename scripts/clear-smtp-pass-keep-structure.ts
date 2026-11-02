import { prisma } from '../src/lib/db'

async function main() {
  await prisma.notificationSetting.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      smtpUser: 'sec@venturefoodskw.com',
      smtpFrom: 'sec@venturefoodskw.com',
      smtpPass: '',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true,
      smtpEnabled: true,
    },
    update: {
      smtpUser: 'sec@venturefoodskw.com',
      smtpFrom: 'sec@venturefoodskw.com',
      smtpPass: '',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true,
      smtpEnabled: true,
    },
  })
  console.log('smtpPass cleared; Google Workspace SMTP structure kept')
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
