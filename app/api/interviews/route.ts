import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const interviews = await prisma.interview.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        evaluation: true,
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    return NextResponse.json({ interviews });
  } catch (err: any) {
    console.error('Error fetching interviews:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
