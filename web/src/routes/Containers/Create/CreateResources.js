import {
    Accordion,
    AccordionDetails,
    AccordionSummary, Box, Button,
    Checkbox,
    FormControlLabel,
    FormGroup, InputAdornment,
    Stack
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Typography from "@mui/material/Typography";
import {grey, orange} from "@mui/material/colors";
import CheckIcon from "@mui/icons-material/Check";
import {useEffect, useMemo, useRef, useState} from "react";
import TextField from "@mui/material/TextField";
import RestoreIcon from "@mui/icons-material/Restore";
import {containerActions, uiActions, useContainerStore} from "./store";

const regexCpuShares = /^[1-9][0-9]{0,5}$/; // 1 ~ 999999
const regexCpuCores = /^(0\.[0-9]{1,2}|[1-9][0-9]?(\.[0-9]{1,2})?)$/; // 0.01 ~ 99.99
const regexMemory = /^[1-9][0-9]{0,4}$/; // 1 ~ 99999

function CheckBoxTextField({checkLabel, inputLabel, inputHelperText, defaultVal = 0, unit, val, regex, parser, onChangeVal, onChangeValid}) {
    const [checked, setChecked] = useState(val > 0);
    const [textVal, setTextVal] = useState(val ? (val + '') : (defaultVal ? defaultVal + '' : ''));
    const [textErr, setTextErr] = useState(false);
    const inputRef = useRef();
    const [toFocus, setToFocus] = useState(false);

    const handleCheckChange = event => {
        setChecked(event.target.checked);
        setToFocus(event.target.checked);
        if (event.target.checked) {
            if (!val && defaultVal) {
                onChangeVal(defaultVal);
            } else {
                onChangeValid(false);
            }
        } else {
            setTextVal(defaultVal ? defaultVal + '' : '');
            setTextErr(false);
            onChangeValid(true);
            onChangeVal(0);
        }
    };

    const handleTextChange = event => {
        setTextVal(event.target.value);
        const valid = regex.test(event.target.value);
        setTextErr(!valid);
        onChangeValid(valid);
        if (valid) {
            onChangeVal(parser(event.target.value));
        }
    };

    useEffect(() => {
        if (checked && toFocus) {
            inputRef.current?.focus();
            setToFocus(false);
        }
    }, [checked, toFocus]);

    return (
        <Box sx={{maxWidth: 300}}>
            <FormGroup sx={{mb: 1}}>
                <FormControlLabel
                    control={<Checkbox
                        checked={checked}
                        onChange={handleCheckChange}
                    />}
                    label={checkLabel}
                />
            </FormGroup>

            <TextField
                label={inputLabel}
                size="small"
                disabled={!checked}
                value={textVal}
                error={textErr}
                onChange={handleTextChange}
                inputRef={inputRef}
                helperText={inputHelperText}
                InputProps={{
                    endAdornment: unit ? (<InputAdornment position="end">{unit}</InputAdornment>) : null
                }}
            />
        </Box>
    );
}

function CreateResources({res, onEdited, onConfirm}) {
    const [editRes, setEditRes] = useState(res);
    const [version, setVersion] = useState(0);
    const editedVal = useRef(false);
    const [versionSwap, setVersionSwap] = useState(0);
    const [valid, setValid] = useState([true, true, true, true]);

    const handleConfirm = () => {
        onConfirm(editRes);
        onEdited(false);
        editedVal.current = false;
    };

    const handleRevert = () => {
        setEditRes(res);
        setVersion(v => v + 1);
    };

    const changed = useMemo(() => {
        let c = false;
        for (const key of Object.keys(res)) {
            if (res[key] !== editRes[key]) {
                c = true;
                break;
            }
        }
        return c;
    }, [editRes, res]);

    useEffect(() => {
        const v = changed;
        if (v !== editedVal.current) {
            onEdited(v);
            editedVal.current = v;
        }
    }, [changed, onEdited]);

    const handleChangeValid = (i, v)  => {
        setValid(valid.map((oldVal, idx) => {
            if (i === idx) {
                return v;
            }
            return oldVal;
        }));
    };

    const invalid = useMemo(() => {
        return valid.indexOf(false) !== -1;
    }, [valid]);

    return (
        <Stack spacing={3} key={version}>
            <CheckBoxTextField
                checkLabel="Set CPU shares"
                inputLabel="Relative weight"
                inputHelperText="From 1 to 999999. Default: 1024."
                defaultVal={1024}
                val={editRes.cpuShares}
                regex={regexCpuShares}
                parser={parseInt}
                onChangeVal={v => {
                    setEditRes(editRes => {
                        return {
                            ...editRes,
                            cpuShares: v
                        };
                    });
                }}
                onChangeValid={v => handleChangeValid(0, v)}
            />

            <CheckBoxTextField
                checkLabel="Limit CPU"
                inputLabel="CPU cores"
                inputHelperText="From 0.01 to 99.99."
                val={editRes.cpuCores}
                regex={regexCpuCores}
                parser={parseFloat}
                onChangeVal={v => {
                    setEditRes(editRes => {
                        return {
                            ...editRes,
                            cpuCores: v
                        };
                    });
                }}
                onChangeValid={v => handleChangeValid(1, v)}
            />

            <CheckBoxTextField
                checkLabel="Limit memory"
                inputLabel="Memory"
                inputHelperText="From 1 to 99999."
                unit="MB"
                val={editRes.memoryMB}
                regex={regexMemory}
                parser={parseInt}
                onChangeVal={v => {
                    setEditRes(editRes => {
                        if (!editRes.setLimitMemorySwap) {
                            // force update memorySwap default value
                            setVersionSwap(v => v + 1);
                        }
                        return {
                            ...editRes,
                            memoryMB: v
                        };
                    });
                }}
                onChangeValid={v => handleChangeValid(2, v)}
            />

            <CheckBoxTextField
                key={versionSwap}
                checkLabel="Limit memory + swap"
                inputLabel="Memory + swap"
                inputHelperText="From 1 to 99999."
                unit="MB"
                defaultVal={editRes.memoryMB * 2}
                val={editRes.memorySwapMB}
                regex={regexMemory}
                parser={parseInt}
                onChangeVal={v => {
                    setEditRes(editRes => {
                        return {
                            ...editRes,
                            memorySwapMB: v
                        };
                    });
                }}
                onChangeValid={v => handleChangeValid(3, v)}
            />

            <Stack direction="row" spacing={1}>
                <Button
                    variant="outlined"
                    disabled={invalid}
                    startIcon={<CheckIcon />}
                    onClick={handleConfirm}
                >
                    Confirm
                </Button>

                <Button
                    variant="outlined"
                    disabled={!changed}
                    startIcon={<RestoreIcon />}
                    onClick={handleRevert}
                    color="warning"
                >
                    Revert
                </Button>
            </Stack>
        </Stack>
    );
}

const accordionIndex = 5;

export default function AccordionResources() {
    const open = useContainerStore(state => state.open[accordionIndex]);
    const disabled = useContainerStore(state => state.disabled[accordionIndex]);
    const edited = useContainerStore(state => state.edited[accordionIndex]);
    const version = useContainerStore(state => state.version[accordionIndex]);

    const res = useContainerStore(state => state.res);

    const onExpandChange = (event, open) => {
        uiActions.toggle(accordionIndex, open);
    };

    const onEdited = edited => {
        uiActions.setEdited(accordionIndex, edited);
    };

    const onConfirm = p => {
        containerActions.setRes(p);

        uiActions.openNext(accordionIndex);
    };

    const texts = [];
    if (res.cpuShares) {
        texts.push("CPU shares: " + res.cpuShares);
    }
    if (res.cpuCores) {
        texts.push("CPU cores: " + res.cpuCores);
    }
    if (res.memoryMB) {
        texts.push("Memory: " + res.memoryMB + " MB");
    }
    if (res.memorySwapMB) {
        texts.push("Memory+Swap: " + res.memorySwapMB + " MB");
    }
    const text = texts.join(", ");

    return (
        <Accordion
            expanded={open}
            onChange={onExpandChange}
            disabled={disabled}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="panel6a-content"
                id="panel6a-header"
            >
                <Typography sx={{ flexGrow: 1 }}>
                    Resources limits
                </Typography>
                {edited && open && (
                    <Typography sx={{color: orange[500]}}>
                        Not saved yet
                    </Typography>
                )}
                {!disabled && !open && text && (
                    <Typography sx={{color: grey[500]}}>
                        {text}
                    </Typography>
                )}
            </AccordionSummary>
            <AccordionDetails>
                <CreateResources
                    key={version}
                    res={res}
                    onEdited={onEdited}
                    onConfirm={onConfirm}
                />
            </AccordionDetails>
        </Accordion>
    );
}