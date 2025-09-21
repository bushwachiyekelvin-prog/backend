import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { investorOpportunities } from "../../db/schema/investorOpportunities";
import { InvestorOpportunitiesModel } from "./investor-opportunities.model";
import { logger } from "../../utils/logger";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

type InvestorOpportunityRow = typeof investorOpportunities.$inferSelect;

function mapRow(r: InvestorOpportunityRow): InvestorOpportunitiesModel.InvestorOpportunityItem {
  return {
    id: r.id,
    name: r.name,
    countryOfOrigin: r.countryOfOrigin ?? null,
    totalFundSize: r.totalFundSize ?? null,
    sectorFocusSsa: r.sectorFocusSsa ?? null,
    countriesOfOperation: r.countriesOfOperation ?? null,
    operatingSince: r.operatingSince ?? null,
    website: r.website ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt?.toISOString?.() ?? null,
    updatedAt: r.updatedAt?.toISOString?.() ?? null,
  };
}

export abstract class InvestorOpportunitiesService {
  static async create(
    clerkId: string,
    body: InvestorOpportunitiesModel.CreateInvestorOpportunityBody,
  ): Promise<InvestorOpportunitiesModel.InvestorOpportunityItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const values = {
        name: body.name,
        countryOfOrigin: body.countryOfOrigin ?? null,
        totalFundSize: body.totalFundSize ?? null,
        sectorFocusSsa: body.sectorFocusSsa ?? null,
        countriesOfOperation: body.countriesOfOperation ?? null,
        operatingSince: body.operatingSince ?? null,
        website: body.website ?? null,
        isActive: body.isActive ?? true,
      };

      const [row] = await db
        .insert(investorOpportunities)
        .values(values)
        .returning();

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error creating investor opportunity:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_INVESTOR_OPPORTUNITY_ERROR] Failed to create investor opportunity");
    }
  }

  static async list(clerkId: string): Promise<InvestorOpportunitiesModel.ListInvestorOpportunitiesResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const rows = await db
        .select()
        .from(investorOpportunities)
        .where(isNull(investorOpportunities.deletedAt));

      return {
        success: true,
        message: "Investor opportunities retrieved successfully",
        data: rows.map(mapRow),
      };
    } catch (error: any) {
      logger.error("Error listing investor opportunities:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_INVESTOR_OPPORTUNITIES_ERROR] Failed to list investor opportunities");
    }
  }

  static async getById(
    clerkId: string,
    id: string,
  ): Promise<InvestorOpportunitiesModel.InvestorOpportunityItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const [row] = await db
        .select()
        .from(investorOpportunities)
        .where(and(eq(investorOpportunities.id, id), isNull(investorOpportunities.deletedAt)))
        .limit(1);
      if (!row) throw httpError(404, "[INVESTOR_OPPORTUNITY_NOT_FOUND] Investor opportunity not found");
      return mapRow(row);
    } catch (error: any) {
      logger.error("Error getting investor opportunity:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_INVESTOR_OPPORTUNITY_ERROR] Failed to get investor opportunity");
    }
  }

  static async update(
    clerkId: string,
    id: string,
    body: InvestorOpportunitiesModel.EditInvestorOpportunityBody,
  ): Promise<InvestorOpportunitiesModel.InvestorOpportunityItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const [existing] = await db
        .select({ id: investorOpportunities.id })
        .from(investorOpportunities)
        .where(and(eq(investorOpportunities.id, id), isNull(investorOpportunities.deletedAt)));
      if (!existing) throw httpError(404, "[INVESTOR_OPPORTUNITY_NOT_FOUND] Investor opportunity not found");

      const [row] = await db
        .update(investorOpportunities)
        .set({
          name: body.name ?? undefined,
          countryOfOrigin: body.countryOfOrigin ?? undefined,
          totalFundSize: body.totalFundSize ?? undefined,
          sectorFocusSsa: body.sectorFocusSsa ?? undefined,
          countriesOfOperation: body.countriesOfOperation ?? undefined,
          operatingSince: body.operatingSince ?? undefined,
          website: body.website ?? undefined,
          isActive: body.isActive ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(investorOpportunities.id, id))
        .returning();

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error updating investor opportunity:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_INVESTOR_OPPORTUNITY_ERROR] Failed to update investor opportunity");
    }
  }

  static async remove(
    clerkId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const [existing] = await db
        .select({ id: investorOpportunities.id })
        .from(investorOpportunities)
        .where(and(eq(investorOpportunities.id, id), isNull(investorOpportunities.deletedAt)));
      if (!existing) throw httpError(404, "[INVESTOR_OPPORTUNITY_NOT_FOUND] Investor opportunity not found");

      await db
        .update(investorOpportunities)
        .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
        .where(eq(investorOpportunities.id, id));

      return { success: true, message: "Investor opportunity deleted successfully" };
    } catch (error: any) {
      logger.error("Error deleting investor opportunity:", error);
      if (error?.status) throw error;
      throw httpError(500, "[DELETE_INVESTOR_OPPORTUNITY_ERROR] Failed to delete investor opportunity");
    }
  }
}
