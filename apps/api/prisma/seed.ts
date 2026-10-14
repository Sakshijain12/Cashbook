// apps/api/prisma/seed.ts
import { PrismaClient, BookType, EntryType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Demo user
  const hash = await bcrypt.hash('password123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'demo@cashbook.app' },
    update: {},
    create: { email: 'demo@cashbook.app', passwordHash: hash, name: 'Demo User' },
  })

  // Books
  const cash = await prisma.book.create({
    data: { userId: user.id, name: 'Cash', type: BookType.cash, color: '#27500A', icon: 'ti-cash', currency: 'JPY' },
  })
  const bank = await prisma.book.create({
    data: { userId: user.id, name: 'Bank', type: BookType.bank, color: '#185FA5', icon: 'ti-building-bank', currency: 'JPY' },
  })
  const suica = await prisma.book.create({
    data: { userId: user.id, name: 'Suica', type: BookType.prepaid, color: '#0F6E56', icon: 'ti-credit-card', currency: 'JPY' },
  })

  // Normal expense categories
  const expenseCats = [
    { name: 'Food & drink', color: '#D85A30', icon: 'ti-shopping-bag' },
    { name: 'Transport',    color: '#378ADD', icon: 'ti-train' },
    { name: 'Shopping',     color: '#7F77DD', icon: 'ti-shopping-cart' },
    { name: 'Bills',        color: '#1D9E75', icon: 'ti-file-invoice' },
    { name: 'Health',       color: '#BA7517', icon: 'ti-heart' },
    { name: 'Entertainment',color: '#D4537E', icon: 'ti-music' },
    { name: 'Rent',         color: '#888780', icon: 'ti-home' },
    { name: 'Education',    color: '#534AB7', icon: 'ti-school' },
    { name: 'Other',        color: '#444441', icon: 'ti-dots' },
  ]
  for (const cat of expenseCats) {
    await prisma.category.create({ data: { userId: user.id, name: cat.name, entryType: EntryType.EXPENSE, color: cat.color, icon: cat.icon } })
  }

  // Normal income categories
  const incomeCats = [
    { name: 'Salary',      color: '#27500A', icon: 'ti-wallet' },
    { name: 'Freelance',   color: '#0F6E56', icon: 'ti-briefcase' },
    { name: 'Business',    color: '#185FA5', icon: 'ti-building' },
    { name: 'Investment',  color: '#854F0B', icon: 'ti-trending-up' },
    { name: 'Other income',color: '#444441', icon: 'ti-dots' },
  ]
  for (const cat of incomeCats) {
    await prisma.category.create({ data: { userId: user.id, name: cat.name, entryType: EntryType.INCOME, color: cat.color, icon: cat.icon } })
  }

  // Transfer categories — all pairs between cash, bank, suica
  const books = [cash, bank, suica]
  for (let i = 0; i < books.length; i++) {
    for (let j = 0; j < books.length; j++) {
      if (i === j) continue
      await prisma.category.create({
        data: {
          userId: user.id,
          name: `${books[i].name} → ${books[j].name}`,
          entryType: EntryType.EXPENSE,
          isTransfer: true,
          fromBookId: books[i].id,
          toBookId: books[j].id,
          isSystem: true,
          color: '#0F6E56',
          icon: 'ti-arrows-right-left',
        },
      })
    }
  }

  console.log('Seed complete.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
