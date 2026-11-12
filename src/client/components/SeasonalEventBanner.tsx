import { Alert } from "@mui/material";
import { getSeasonalEvent } from "../../lib/seasonal-events";

export default function SeasonalEventBanner() {
    const event = getSeasonalEvent();

    if (!event) return null;

    switch (event.id) {
        case "godzilla-day":
            return (
                <Alert severity="info">
                    Happy Godzilla Day! Celebrate the King of the Monsters.
                </Alert>
            );

        case "april-fools":
            return (
                <Alert severity="warning">
                    Happy April Fools' Day! Something feels a little unusual...
                </Alert>
            );

        default:
            return null;
    }
}
