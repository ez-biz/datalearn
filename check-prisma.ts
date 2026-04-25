import { prisma } from './lib/prisma'

async function check() {
    console.log('Checking prisma instance...')
    if (prisma.page) {
        console.log('✅ prisma.page exists')
    } else {
        console.log('❌ prisma.page is UNDEFINED')
        console.log('Keys:', Object.keys(prisma))
    }
}

check()
