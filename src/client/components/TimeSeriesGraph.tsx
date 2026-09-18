import { Box, Stack, Typography, useTheme } from "@mui/material";

export interface TimeSeriesPoint {
    day: string;
    values: Record<string, number>;
}

export interface TimeSeries {
    key: string;
    label: string;
    color?: string;
}

interface Props {
    data: TimeSeriesPoint[];
    series: TimeSeries[];
    height?: number;
}

export function TimeSeriesGraph({ data, series, height = 280 }: Props) {
    const theme = useTheme();
    const width = 900;
    const padding = { top: 18, right: 20, bottom: 42, left: 48 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(
        1,
        ...data.flatMap((point) => series.map(({ key }) => point.values[key] ?? 0)),
    );
    const colors = [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.info.main,
        theme.palette.error.main,
    ];
    const x = (index: number) =>
        padding.left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
    const y = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;
    const labelIndexes = [
        ...new Set([0, Math.floor((data.length - 1) / 2), Math.max(0, data.length - 1)]),
    ];

    return (
        <Stack spacing={1.5}>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    width="100%"
                    height={height}
                    role="img"
                    aria-label="Analytics over time"
                    style={{ minWidth: 620 }}
                >
                    {Array.from({ length: 5 }, (_, index) => {
                        const value = (maxValue / 4) * index;
                        const lineY = y(value);
                        return (
                            <g key={`grid-${index}`}>
                                <line
                                    x1={padding.left}
                                    x2={width - padding.right}
                                    y1={lineY}
                                    y2={lineY}
                                    stroke={theme.palette.divider}
                                    strokeDasharray="4 4"
                                />
                                <text
                                    x={padding.left - 8}
                                    y={lineY + 4}
                                    textAnchor="end"
                                    fontSize="11"
                                    fill={theme.palette.text.secondary}
                                >
                                    {Math.round(value).toLocaleString()}
                                </text>
                            </g>
                        );
                    })}
                    {series.map((item, seriesIndex) => {
                        const color = item.color ?? colors[seriesIndex % colors.length];
                        const points = data
                            .map((point, index) => `${x(index)},${y(point.values[item.key] ?? 0)}`)
                            .join(" ");
                        return (
                            <g key={item.key}>
                                <polyline
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="2.5"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    points={points}
                                />
                                {data.map((point, index) => (
                                    <circle
                                        key={`${item.key}-${point.day}`}
                                        cx={x(index)}
                                        cy={y(point.values[item.key] ?? 0)}
                                        r="2.5"
                                        fill={color}
                                    />
                                ))}
                            </g>
                        );
                    })}
                    {labelIndexes.map((index) => (
                        <text
                            key={`label-${index}`}
                            x={x(index)}
                            y={height - 12}
                            textAnchor={
                                index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"
                            }
                            fontSize="11"
                            fill={theme.palette.text.secondary}
                        >
                            {data[index]?.day.slice(5) ?? ""}
                        </text>
                    ))}
                </svg>
            </Box>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {series.map((item, index) => (
                    <Stack key={item.key} direction="row" spacing={0.75} alignItems="center">
                        <Box
                            sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: item.color ?? colors[index % colors.length],
                            }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            {item.label}
                        </Typography>
                    </Stack>
                ))}
            </Stack>
        </Stack>
    );
}
