import {
    Button,
    Card,
    CardContent,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    getSeasonalEventConfigs,
    MAX_SEASONAL_EVENT_NAME_LENGTH,
    MAX_SEASONAL_EVENT_PRIORITY,
    MAX_SEASONAL_EVENT_RANGES,
    resetSeasonalEventConfig,
    resetSeasonalEventConfigs,
    setSeasonalEventConfigs,
    type SeasonalDate,
    type SeasonalEventConfig,
    type SeasonalEventId,
} from "../../lib/seasonal-events";

interface SeasonalEventSettingsProps {
    onSave?: () => void;
}

function toDateInputValue(date: SeasonalDate): string {
    return `2000-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function fromDateInputValue(value: string): SeasonalDate | undefined {
    const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return undefined;

    const month = Number(match[1]);
    const day = Number(match[2]);
    if (!Number.isInteger(month) || !Number.isInteger(day)) return undefined;
    if (month < 1 || month > 12 || day < 1) return undefined;

    const daysInMonth = new Date(2000, month, 0).getDate();
    return day <= daysInMonth ? { month, day } : undefined;
}

export function SeasonalEventSettings({ onSave }: SeasonalEventSettingsProps) {
    const { t } = useTranslation();
    const [configs, setConfigs] = useState<SeasonalEventConfig[]>(getSeasonalEventConfigs);
    const [error, setError] = useState("");

    const persist = (next: SeasonalEventConfig[]) => {
        if (!setSeasonalEventConfigs(next)) {
            setError(t("seasonalEventStorageError"));
            return false;
        }

        setConfigs(next);
        setError("");
        onSave?.();
        return true;
    };

    const updateEvent = (
        id: SeasonalEventId,
        update: (event: SeasonalEventConfig) => SeasonalEventConfig,
    ) => {
        persist(configs.map((event) => (event.id === id ? update(event) : event)));
    };

    const updateRangeDate = (
        event: SeasonalEventConfig,
        rangeIndex: number,
        edge: "start" | "end",
        value: string,
    ) => {
        const date = fromDateInputValue(value);
        if (!date) {
            setError(t("seasonalEventInvalidDate"));
            return;
        }

        updateEvent(event.id, (current) => ({
            ...current,
            ranges: current.ranges.map((range, index) =>
                index === rangeIndex ? { ...range, [edge]: date } : range,
            ),
        }));
    };

    const handleResetEvent = (id: SeasonalEventId) => {
        if (!resetSeasonalEventConfig(id)) {
            setError(t("seasonalEventStorageError"));
            return;
        }

        setConfigs(getSeasonalEventConfigs());
        setError("");
        onSave?.();
    };

    const handleResetAll = () => {
        if (!resetSeasonalEventConfigs()) {
            setError(t("seasonalEventStorageError"));
            return;
        }

        setConfigs(getSeasonalEventConfigs());
        setError("");
        onSave?.();
    };

    return (
        <Stack spacing={2}>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                justifyContent="space-between"
            >
                <Stack spacing={0.5}>
                    <Typography variant="subtitle1">{t("seasonalEventCustomization")}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t("seasonalEventCustomizationHelp")}
                    </Typography>
                </Stack>
                <Button variant="outlined" size="small" onClick={handleResetAll}>
                    {t("seasonalEventResetAll")}
                </Button>
            </Stack>

            {error ? (
                <Typography color="error" role="alert">
                    {error}
                </Typography>
            ) : null}

            {configs.map((event) => (
                <Card variant="outlined" key={event.id}>
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                justifyContent="space-between"
                                alignItems={{ xs: "stretch", sm: "center" }}
                                spacing={1}
                            >
                                <Typography variant="h6" component="h3">
                                    {event.name}
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={event.enabled}
                                            onChange={(inputEvent) =>
                                                updateEvent(event.id, (current) => ({
                                                    ...current,
                                                    enabled: inputEvent.target.checked,
                                                }))
                                            }
                                        />
                                    }
                                    label={t("seasonalEventEnabled")}
                                />
                            </Stack>

                            <TextField
                                label={t("seasonalEventName")}
                                value={event.name}
                                size="small"
                                fullWidth
                                inputProps={{ maxLength: MAX_SEASONAL_EVENT_NAME_LENGTH }}
                                onChange={(inputEvent) => {
                                    const name = inputEvent.target.value;
                                    if (!name.trim()) return;
                                    updateEvent(event.id, (current) => ({ ...current, name }));
                                }}
                            />

                            <TextField
                                label={t("seasonalEventPriority")}
                                type="number"
                                size="small"
                                value={event.priority}
                                inputProps={{
                                    min: 0,
                                    max: MAX_SEASONAL_EVENT_PRIORITY,
                                    step: 1,
                                }}
                                helperText={t("seasonalEventPriorityHelp")}
                                onChange={(inputEvent) => {
                                    const priority = Number(inputEvent.target.value);
                                    if (
                                        !Number.isInteger(priority) ||
                                        priority < 0 ||
                                        priority > MAX_SEASONAL_EVENT_PRIORITY
                                    ) {
                                        return;
                                    }
                                    updateEvent(event.id, (current) => ({ ...current, priority }));
                                }}
                            />

                            <Stack spacing={1}>
                                <Typography variant="subtitle2">
                                    {t("seasonalEventDateRanges")}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t("seasonalEventDateRangesHelp")}
                                </Typography>

                                {event.ranges.map((range, index) => (
                                    <Stack
                                        key={`${event.id}-range-${index}`}
                                        direction={{ xs: "column", sm: "row" }}
                                        alignItems={{ xs: "stretch", sm: "center" }}
                                        spacing={1}
                                    >
                                        <TextField
                                            type="date"
                                            label={t("seasonalEventStart")}
                                            value={toDateInputValue(range.start)}
                                            size="small"
                                            fullWidth
                                            slotProps={{ inputLabel: { shrink: true } }}
                                            onChange={(inputEvent) =>
                                                updateRangeDate(
                                                    event,
                                                    index,
                                                    "start",
                                                    inputEvent.target.value,
                                                )
                                            }
                                        />
                                        <TextField
                                            type="date"
                                            label={t("seasonalEventEnd")}
                                            value={toDateInputValue(range.end)}
                                            size="small"
                                            fullWidth
                                            slotProps={{ inputLabel: { shrink: true } }}
                                            onChange={(inputEvent) =>
                                                updateRangeDate(
                                                    event,
                                                    index,
                                                    "end",
                                                    inputEvent.target.value,
                                                )
                                            }
                                        />
                                        <Button
                                            color="error"
                                            variant="text"
                                            size="small"
                                            onClick={() =>
                                                updateEvent(event.id, (current) => ({
                                                    ...current,
                                                    ranges: current.ranges.filter(
                                                        (_, rangeIndex) => rangeIndex !== index,
                                                    ),
                                                }))
                                            }
                                        >
                                            {t("seasonalEventRemoveRange")}
                                        </Button>
                                    </Stack>
                                ))}

                                {event.ranges.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        {t("seasonalEventNoRanges")}
                                    </Typography>
                                ) : null}

                                <Button
                                    variant="outlined"
                                    size="small"
                                    disabled={event.ranges.length >= MAX_SEASONAL_EVENT_RANGES}
                                    onClick={() =>
                                        updateEvent(event.id, (current) => {
                                            const template = current.ranges[0] ?? {
                                                start: { month: 1, day: 1 },
                                                end: { month: 1, day: 1 },
                                            };

                                            return {
                                                ...current,
                                                ranges: [
                                                    ...current.ranges,
                                                    {
                                                        start: { ...template.start },
                                                        end: { ...template.end },
                                                    },
                                                ],
                                            };
                                        })
                                    }
                                >
                                    {t("seasonalEventAddRange")}
                                </Button>
                            </Stack>

                            <Stack direction="row" justifyContent="flex-end">
                                <Button
                                    variant="text"
                                    size="small"
                                    onClick={() => handleResetEvent(event.id)}
                                >
                                    {t("seasonalEventReset")}
                                </Button>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>
            ))}
        </Stack>
    );
}
