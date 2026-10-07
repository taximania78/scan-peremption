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
        expirationDate: true,
      },
      orderBy: {
        expirationDate: "asc",
      },
    });

    // Dates stockées à minuit UTC (saisie <input type="date">) : la partie date de l'ISO est la date saisie.
    return NextResponse.json(
      expiringProducts.map((product) => ({
        ...product,
        expirationDate: product.expirationDate.toISOString().slice(0, 10),
      }))
    );
  } catch (error) {
    console.error("Error fetching expiring products:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des produits expirants" },
      { status: 500 }
    );
  }
}
