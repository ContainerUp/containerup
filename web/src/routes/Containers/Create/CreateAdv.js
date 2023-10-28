import {
    Accordion,
    AccordionDetails,
    AccordionSummary, Box, Button,
    Checkbox,
    FormControlLabel,
    FormGroup,
    Stack, Tooltip
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Typography from "@mui/material/Typography";
import {grey, orange} from "@mui/material/colors";
import CheckIcon from "@mui/icons-material/Check";
import {useEffect, useMemo, useRef, useState} from "react";
import RestoreIcon from "@mui/icons-material/Restore";
import {containerActions, uiActions, useContainerStore} from "./store";
import InfoIcon from "@mui/icons-material/Info";
import Link from "@mui/material/Link";

function CreateAdv({adv, onEdited, onConfirm}) {
    const [editAdv, setEditAdv] = useState(adv);
    const [version, setVersion] = useState(0);
    const editedVal = useRef(false);

    const handleChangeStart = event => {
        setEditAdv({
            ...editAdv,
            start: event.target.checked
        });
    };

    const handleChangeAlwaysRestart = event => {
        setEditAdv({
            ...editAdv,
            alwaysRestart: event.target.checked
        });
    };

    const handleConfirm = () => {
        onConfirm(editAdv);
        onEdited(false);
        editedVal.current = false;
    };

    const handleRevert = () => {
        setEditAdv(adv);
        setVersion(v => v + 1);
    };

    const changed = useMemo(() => {
        let c = false;
        for (const key of Object.keys(adv)) {
            if (adv[key] !== editAdv[key]) {
                c = true;
                break;
            }
        }
        return c;
    }, [editAdv, adv]);

    useEffect(() => {
        const v = changed;
        if (v !== editedVal.current) {
            onEdited(v);
            editedVal.current = v;
        }
    }, [changed, onEdited]);

    return (
        <Stack spacing={3} key={version}>
            <Box sx={{maxWidth: 350}}>
                <FormGroup row={true}>
                    <FormControlLabel
                        control={<Checkbox
                            checked={editAdv.start}
                            onChange={handleChangeStart}
                        />}
                        label="Start the container (default: yes)"
                    />
                </FormGroup>

                <FormGroup row={true}>
                    <FormControlLabel
                        control={<Checkbox
                            checked={editAdv.alwaysRestart}
                            onChange={handleChangeAlwaysRestart}
                        />}
                        label="Restart policy: always (default: no)"
                    />
                    <Typography>
                        <Tooltip title="Learn more about restart policy">
                            <Link href="https://containerup.org/faq/#what-is-a-restart-policy"  color="#666666" target="_blank">
                                <InfoIcon fontSize="small" sx={{mt: '12px'}} />
                            </Link>
                        </Tooltip>
                    </Typography>
                </FormGroup>
            </Box>

            <Stack direction="row" spacing={1}>
                <Button
                    variant="outlined"
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

const accordionIndex = 6;

export default function AccordionAdv() {
    const open = useContainerStore(state => state.open[accordionIndex]);
    const disabled = useContainerStore(state => state.disabled[accordionIndex]);
    const edited = useContainerStore(state => state.edited[accordionIndex]);
    const version = useContainerStore(state => state.version[accordionIndex]);

    const adv = useContainerStore(state => state.adv);

    const onExpandChange = (event, open) => {
        uiActions.toggle(accordionIndex, open);
    };

    const onEdited = edited => {
        uiActions.setEdited(accordionIndex, edited);
    };

    const onConfirm = p => {
        containerActions.setAdv(p);
        uiActions.openNext(accordionIndex);
    };

    const texts = [];
    if (!adv.start) {
        texts.push("Do not start");
    }
    if (adv.alwaysRestart) {
        texts.push("Always restart");
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
                aria-controls="panel7a-content"
                id="panel7a-header"
            >
                <Typography sx={{ flexGrow: 1 }}>
                    Advanced settings
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
                <CreateAdv
                    key={version}
                    adv={adv}
                    onEdited={onEdited}
                    onConfirm={onConfirm}
                />
            </AccordionDetails>
        </Accordion>
    );
}