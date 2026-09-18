import { Autocomplete, Box, Chip, CircularProgress, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Post } from "../lib/types";

interface TagOption {
    id: string;
    name: string;
    slug: string;
    postCount: number;
}

interface SearchSuggestion {
    label: string;
    type: "post" | "user" | "tag" | "category";
}

interface SearchResponse {
    data?: {
        posts?: Post[];
        users?: Array<{ id: string; name: string }>;
        tags?: Array<{ id: string; name: string }>;
        categories?: Array<{ id: string; name: string }>;
    };
}

const tagSuggestionDelay = 180;
const searchSuggestionDelay = 220;

function normalizeTags(values: string[]) {
    return values
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean)
        .filter(
            (tag, index, all) =>
                all.findIndex(
                    (candidate) => candidate.toLocaleLowerCase() === tag.toLocaleLowerCase(),
                ) === index,
        );
}

export function TagAutocomplete({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const [inputValue, setInputValue] = useState("");
    const [options, setOptions] = useState<TagOption[]>([]);
    const [loading, setLoading] = useState(false);
    const selectedValues = useMemo(
        () =>
            value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
        [value],
    );

    useEffect(() => {
        const term = inputValue.trim();
        const timer = window.setTimeout(() => {
            setLoading(true);
            void api<{ data?: TagOption[] }>(
                `/v1/tags/autocomplete?q=${encodeURIComponent(term)}&limit=10`,
            )
                .then((response) => setOptions(response.data ?? []))
                .catch(() => setOptions([]))
                .finally(() => setLoading(false));
        }, tagSuggestionDelay);
        return () => window.clearTimeout(timer);
    }, [inputValue]);

    const mergedOptions = useMemo(() => {
        const known = new Set(options.map((option) => option.name.toLocaleLowerCase()));
        return [
            ...options,
            ...selectedValues
                .filter((tag) => !known.has(tag.toLocaleLowerCase()))
                .map((tag) => ({ id: `local:${tag}`, name: tag, slug: tag, postCount: 0 })),
        ];
    }, [options, selectedValues]);

    const selectTags = (values: string[]) => onChange(normalizeTags(values).join(", "));

    return (
        <Autocomplete<TagOption, true, false, true>
            multiple
            freeSolo
            options={mergedOptions}
            value={selectedValues.map((name) => ({
                id: `value:${name}`,
                name,
                slug: name,
                postCount: 0,
            }))}
            inputValue={inputValue}
            loading={loading}
            filterOptions={(available) => available}
            limitTags={4}
            isOptionEqualToValue={(option, selected) =>
                option.name.toLocaleLowerCase() === selected.name.toLocaleLowerCase()
            }
            getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
            onInputChange={(_event, nextInputValue) => setInputValue(nextInputValue)}
            onChange={(_event, nextValues) => {
                selectTags(nextValues.map((tag) => (typeof tag === "string" ? tag : tag.name)));
                setInputValue("");
            }}
            onKeyDown={(event) => {
                if (event.key !== ",") return;
                const pending = inputValue.trim();
                if (!pending) return;
                event.preventDefault();
                selectTags([...selectedValues, pending]);
                setInputValue("");
            }}
            renderTags={(tagValues, getTagProps) =>
                tagValues.map((tag, index) => (
                    <Chip
                        {...getTagProps({ index })}
                        key={`${tag.name.toLocaleLowerCase()}-${index}`}
                        label={tag.name}
                        size="small"
                        variant="outlined"
                        sx={{ maxWidth: 180 }}
                    />
                ))
            }
            renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2">{option.name}</Typography>
                        {option.postCount > 0 ? (
                            <Typography variant="caption" color="text.secondary">
                                {option.postCount} post{option.postCount === 1 ? "" : "s"}
                            </Typography>
                        ) : null}
                    </Box>
                </Box>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="Tags"
                    placeholder={selectedValues.length ? "Add a tag" : "Search tags"}
                    helperText="Tags appear as chips inside the field. Press Enter or comma to add a tag."
                    slotProps={{
                        input: {
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading ? (
                                        <CircularProgress color="inherit" size={18} />
                                    ) : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        },
                    }}
                />
            )}
        />
    );
}

export function SearchAutocomplete({
    value,
    onChange,
    onSubmit,
    fullWidth = false,
}: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    fullWidth?: boolean;
}) {
    const [inputValue, setInputValue] = useState(value);
    const [options, setOptions] = useState<SearchSuggestion[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => setInputValue(value), [value]);

    useEffect(() => {
        const term = inputValue.trim();
        if (!term) {
            setOptions([]);
            setLoading(false);
            return;
        }
        const timer = window.setTimeout(() => {
            setLoading(true);
            void api<SearchResponse>(`/v1/search?q=${encodeURIComponent(term)}&type=all&limit=8`)
                .then((response) => {
                    const data = response.data;
                    const suggestions: SearchSuggestion[] = [
                        ...(data?.posts ?? [])
                            .slice(0, 3)
                            .filter(
                                (post) =>
                                    typeof post.title === "string" && post.title.trim().length > 0,
                            )
                            .map((post) => ({
                                label: post.title as string,
                                type: "post" as const,
                            })),
                        ...(data?.users ?? [])
                            .slice(0, 2)
                            .map((user) => ({ label: user.name, type: "user" as const })),
                        ...(data?.tags ?? [])
                            .slice(0, 2)
                            .map((tag) => ({ label: tag.name, type: "tag" as const })),
                        ...(data?.categories ?? []).slice(0, 2).map((category) => ({
                            label: category.name,
                            type: "category" as const,
                        })),
                    ];
                    setOptions(
                        suggestions
                            .filter(
                                (suggestion, index, all) =>
                                    all.findIndex(
                                        (candidate) =>
                                            candidate.label.toLocaleLowerCase() ===
                                            suggestion.label.toLocaleLowerCase(),
                                    ) === index,
                            )
                            .slice(0, 8),
                    );
                })
                .catch(() => setOptions([]))
                .finally(() => setLoading(false));
        }, searchSuggestionDelay);
        return () => window.clearTimeout(timer);
    }, [inputValue]);

    return (
        <Autocomplete<SearchSuggestion, false, false, true>
            freeSolo
            fullWidth={fullWidth}
            options={options}
            value={null}
            inputValue={inputValue}
            loading={loading}
            filterOptions={(available) => available}
            getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
            onInputChange={(_event, nextInputValue) => {
                setInputValue(nextInputValue);
                onChange(nextInputValue);
            }}
            onChange={(_event, nextValue) => {
                if (typeof nextValue === "string") {
                    onChange(nextValue);
                    return;
                }
                if (nextValue) {
                    onChange(nextValue.label);
                    setInputValue(nextValue.label);
                    onSubmit();
                }
            }}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.defaultMuiPrevented = true;
                    onSubmit();
                }
            }}
            renderOption={(props, option) => (
                <Box component="li" {...props} key={`${option.type}:${option.label}`}>
                    <Typography variant="body2">{option.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {option.type}
                    </Typography>
                </Box>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="Search"
                    placeholder="Search posts, users, tags, or categories"
                    slotProps={{
                        input: {
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading ? (
                                        <CircularProgress color="inherit" size={18} />
                                    ) : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        },
                    }}
                />
            )}
        />
    );
}
