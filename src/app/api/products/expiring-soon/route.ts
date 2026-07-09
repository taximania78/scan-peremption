import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    const expiringProducts = await prisma.product.findMany({
      where: {
        expirationDate: {
          lte: threeDaysFromNow,
        },
      },
      select: {
        id: true,
        productName: true,
      },
      orderBy: {
        expirationDate: "asc",
      },
    });

    return NextResponse.json(expiringProducts);
  } catch (error) {
    console.error("Error fetching expiring products:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des produits expirants" },
      { status: 500 }
    );
  }
}
