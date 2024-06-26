import { PONDER_CLIENT } from "../../app.config";
import { gql } from "@apollo/client";
import { PositionQuery } from "../../redux/slices/positions.types";
import { getAddress } from "viem";
import { NextApiRequest, NextApiResponse } from "next";

let fetchedPositions: PositionQuery[] = [];

export async function fetchPositions(): Promise<PositionQuery[]> {
	const { data } = await PONDER_CLIENT.query({
		query: gql`
			query {
				positions(orderBy: "availableForClones", orderDirection: "desc") {
					items {
						position
						owner
						zchf
						collateral
						price

						created
						isOriginal
						isClone
						denied
						closed
						original

						minimumCollateral
						annualInterestPPM
						reserveContribution
						start

						expiration
						challengePeriod

						zchfName
						zchfSymbol
						zchfDecimals

						collateralName
						collateralSymbol
						collateralDecimals
						collateralBalance

						limitForPosition
						limitForClones
						availableForPosition
						availableForClones
						minted
					}
				}
			}
		`,
	});

	if (!data || !data.positions) {
		console.log("No positions found, returning previous state");
		return fetchedPositions;
	}

	const list: PositionQuery[] = [];
	if (data && data.positions) {
		data.positions.items.forEach(async (p: PositionQuery) => {
			list.push({
				position: getAddress(p.position),
				owner: getAddress(p.owner),
				zchf: getAddress(p.zchf),
				collateral: getAddress(p.collateral),
				price: p.price,

				created: p.created,
				isOriginal: p.isOriginal,
				isClone: p.isClone,
				denied: p.denied,
				closed: p.closed,
				original: getAddress(p.original),

				minimumCollateral: p.minimumCollateral,
				annualInterestPPM: p.annualInterestPPM,
				reserveContribution: p.reserveContribution,
				start: p.start,
				// cooldown: p.cooldown,
				expiration: p.expiration,
				challengePeriod: p.challengePeriod,

				zchfName: p.zchfName,
				zchfSymbol: p.zchfSymbol,
				zchfDecimals: p.zchfDecimals,

				collateralName: p.collateralName,
				collateralSymbol: p.collateralSymbol,
				collateralDecimals: p.collateralDecimals,
				collateralBalance: p.collateralBalance,

				limitForPosition: p.limitForPosition,
				limitForClones: p.limitForClones,
				availableForPosition: p.availableForPosition,
				availableForClones: p.availableForClones,
				minted: p.minted,
			});
		});
	}

	fetchedPositions = list;
	return list;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
	if (fetchedPositions.length === 0) await fetchPositions();
	res.status(200).json(fetchedPositions);
}

fetchPositions();
setInterval(fetchPositions, 10 * 1000);
