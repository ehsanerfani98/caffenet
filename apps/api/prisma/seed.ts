import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  // Users
  { slug: 'users.view', name: 'View users', group: 'users' },
  { slug: 'users.update', name: 'Update users', group: 'users' },
  { slug: 'users.delete', name: 'Delete users', group: 'users' },
  // Roles & permissions
  { slug: 'roles.view', name: 'View roles', group: 'roles' },
  { slug: 'roles.create', name: 'Create roles', group: 'roles' },
  { slug: 'roles.update', name: 'Update roles', group: 'roles' },
  { slug: 'roles.delete', name: 'Delete roles', group: 'roles' },
  // Categories
  { slug: 'categories.view', name: 'View categories', group: 'categories' },
  { slug: 'categories.create', name: 'Create categories', group: 'categories' },
  { slug: 'categories.update', name: 'Update categories', group: 'categories' },
  { slug: 'categories.delete', name: 'Delete categories', group: 'categories' },
  // Services
  { slug: 'services.view', name: 'View services', group: 'services' },
  { slug: 'services.create', name: 'Create services', group: 'services' },
  { slug: 'services.update', name: 'Update services', group: 'services' },
  { slug: 'services.delete', name: 'Delete services', group: 'services' },
  // Requests
  { slug: 'requests.view', name: 'View requests', group: 'requests' },
  { slug: 'requests.create', name: 'Create requests', group: 'requests' },
  { slug: 'requests.update', name: 'Update requests', group: 'requests' },
  { slug: 'requests.assign', name: 'Assign requests', group: 'requests' },
  { slug: 'requests.complete', name: 'Complete requests', group: 'requests' },
  { slug: 'requests.cancel', name: 'Cancel requests', group: 'requests' },
  // Pricing
  { slug: 'pricing.view', name: 'View pricing', group: 'pricing' },
  { slug: 'pricing.update', name: 'Update pricing', group: 'pricing' },
  // Discounts
  { slug: 'discounts.view', name: 'View discounts', group: 'discounts' },
  { slug: 'discounts.create', name: 'Create discounts', group: 'discounts' },
  { slug: 'discounts.update', name: 'Update discounts', group: 'discounts' },
  { slug: 'discounts.delete', name: 'Delete discounts', group: 'discounts' },
  { slug: 'discounts.apply', name: 'Apply discounts to requests', group: 'discounts' },
  // Wallet
  { slug: 'wallet.view', name: 'View own wallet', group: 'wallet' },
  { slug: 'wallet.view.all', name: 'View all wallets', group: 'wallet' },
  { slug: 'wallet.deposit', name: 'Deposit to wallet', group: 'wallet' },
  { slug: 'wallet.adjust', name: 'Manual wallet adjustment', group: 'wallet' },
  { slug: 'wallet.refund', name: 'Issue refunds', group: 'wallet' },
  // Payments
  { slug: 'payments.view', name: 'View payments', group: 'payments' },
  { slug: 'payments.refund', name: 'Refund payments', group: 'payments' },
  // Invoices
  { slug: 'invoices.view', name: 'View invoices', group: 'invoices' },
  // Chat
  { slug: 'chat.view', name: 'View chat rooms', group: 'chat' },
  { slug: 'chat.send', name: 'Send messages', group: 'chat' },
  // Notifications
  { slug: 'notifications.view', name: 'View own notifications', group: 'notifications' },
  { slug: 'notifications.send', name: 'Send notifications', group: 'notifications' },
  // Reports
  { slug: 'reports.view', name: 'View reports', group: 'reports' },
  // Audit
  { slug: 'audit_logs.view', name: 'View audit logs', group: 'audit_logs' },
  // Settings
  { slug: 'settings.update', name: 'Update system settings', group: 'settings' },
  // Operators
  { slug: 'operators.view', name: 'View operators', group: 'operators' },
  { slug: 'operators.create', name: 'Create operators', group: 'operators' },
  { slug: 'operators.update', name: 'Update operators', group: 'operators' },
  { slug: 'operators.deactivate', name: 'Deactivate operators', group: 'operators' },
];

const customerPermissions = [
  'users.view', // own profile only (enforced by ownership check)
  'categories.view',
  'services.view',
  'requests.view',
  'requests.create',
  'requests.cancel',
  'wallet.view',
  'wallet.deposit',
  'invoices.view',
  'chat.view',
  'chat.send',
  'notifications.view',
];

const operatorPermissions = [
  ...customerPermissions,
  'requests.assign',
  'requests.update',
  'requests.complete',
  'pricing.view',
  'pricing.update',
  'discounts.apply',
  'operators.view',
  'requests.view', // already included but explicit
];

const adminPermissions = permissions.map((p) => p.slug);

async function main() {
  console.log('🌱 Seeding permissions, roles, and system settings...');

  // Permissions
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: { name: perm.name, group: perm.group },
      create: perm,
    });
  }
  console.log(`✅ ${permissions.length} permissions seeded`);

  // Roles
  const customerRole = await prisma.role.upsert({
    where: { name: 'customer' },
    update: {},
    create: { name: 'customer', slug: 'customer', description: 'مشتری', isSystem: true },
  });
  const operatorRole = await prisma.role.upsert({
    where: { name: 'operator' },
    update: {},
    create: { name: 'operator', slug: 'operator', description: 'اپراتور کافی‌نت', isSystem: true },
  });
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', slug: 'admin', description: 'مدیر سیستم', isSystem: true },
  });
  console.log('✅ 3 roles seeded (customer, operator, admin)');

  // Role permissions
  await prisma.rolePermission.deleteMany({ where: { roleId: customerRole.id } });
  await prisma.rolePermission.deleteMany({ where: { roleId: operatorRole.id } });
  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });

  const customerPerms = await prisma.permission.findMany({
    where: { slug: { in: customerPermissions } },
  });
  await prisma.rolePermission.createMany({
    data: customerPerms.map((p) => ({ roleId: customerRole.id, permissionId: p.id })),
  });

  const operatorPerms = await prisma.permission.findMany({
    where: { slug: { in: operatorPermissions } },
  });
  await prisma.rolePermission.createMany({
    data: operatorPerms.map((p) => ({ roleId: operatorRole.id, permissionId: p.id })),
  });

  const adminPerms = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
  });
  console.log('✅ Role permissions mapped');

  // Contact methods (system)
  const contactMethods = [
    { name: 'Phone', slug: 'phone', description: 'تماس تلفنی', icon: 'phone', sortOrder: 1 },
    { name: 'WhatsApp', slug: 'whatsapp', description: 'واتس‌اپ', icon: 'whatsapp', sortOrder: 2 },
    { name: 'Telegram', slug: 'telegram', description: 'تلگرام', icon: 'telegram', sortOrder: 3 },
    { name: 'SMS', slug: 'sms', description: 'پیامک', icon: 'message', sortOrder: 4 },
    { name: 'Internal Chat', slug: 'internal_chat', description: 'چت داخلی', icon: 'chat', sortOrder: 5 },
    { name: 'Email', slug: 'email', description: 'ایمیل', icon: 'mail', sortOrder: 6 },
  ];
  for (const cm of contactMethods) {
    await prisma.contactMethod.upsert({
      where: { slug: cm.slug },
      update: { ...cm, isSystem: true },
      create: { ...cm, isSystem: true },
    });
  }
  console.log(`✅ ${contactMethods.length} contact methods seeded`);

  // System settings (with sensible defaults)
  const settings = [
    { key: 'system.name', value: 'Caffenet', type: 'string', isSecret: false, description: 'نام سیستم' },
    { key: 'system.name_fa', value: 'کافی‌نت', type: 'string', isSecret: false, description: 'نام فارسی سیستم' },
    { key: 'system.currency', value: 'IRT', type: 'string', isSecret: false, description: 'واحد پول' },
    { key: 'system.timezone', value: 'Asia/Tehran', type: 'string', isSecret: false, description: 'منطقه زمانی' },
    { key: 'system.default_locale', value: 'fa', type: 'string', isSecret: false, description: 'زبان پیش‌فرض' },
    { key: 'file_upload.max_size', value: '10485760', type: 'number', isSecret: false, description: 'حداکثر حجم فایل (bytes)' },
    { key: 'file_upload.allowed_mimes', valueJson: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], type: 'json', isSecret: false, description: 'MIMEهای مجاز' },
    { key: 'request.auto_assign_strategy', value: 'manual', type: 'string', isSecret: false, description: 'استراتژی تخصیص خودکار اپراتور' },
    { key: 'payment.gateway', value: 'zarinpal', type: 'string', isSecret: false, description: 'درگاه پرداخت فعال' },
    { key: 'sms.provider', value: 'ipanel', type: 'string', isSecret: false, description: 'ارائه‌دهنده SMS' },
    { key: 'pusher.cluster', value: 'mt1', type: 'string', isSecret: false, description: 'خوشه Pusher' },
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s as never,
    });
  }
  console.log(`✅ ${settings.length} system settings seeded`);

  // Default categories
  const categories = [
    { name: 'خدمات اینترنتی', slug: 'internet-services', description: 'انجام کارهای اینترنتی', icon: 'wifi', sortOrder: 1 },
    { name: 'مدارک و امور اداری', slug: 'documents', description: 'تکمیل و ارسال مدارک', icon: 'file-text', sortOrder: 2 },
    { name: 'پرداخت‌ها', slug: 'payments', description: 'پرداخت قبوض و صورت‌حساب‌ها', icon: 'credit-card', sortOrder: 3 },
    { name: 'بازار و خرید', slug: 'shopping', description: 'خرید آنلاین کالا و خدمات', icon: 'shopping-bag', sortOrder: 4 },
    { name: 'سایر', slug: 'other', description: 'خدمات متفرقه', icon: 'more-horizontal', sortOrder: 99 },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { ...c },
      create: c,
    });
  }
  console.log(`✅ ${categories.length} default categories seeded`);

  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
