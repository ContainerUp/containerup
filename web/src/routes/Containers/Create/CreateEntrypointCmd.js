import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Autocomplete,
    Box,
    Button,
    Chip,
    Stack,
    Tooltip
} from "@mui/material";
import TextField from "@mui/material/TextField";
import {useEffect, useMemo, useRef, useState} from "react";
import EditIcon from '@mui/icons-material/Edit';
import ClearIcon from '@mui/icons-material/Clear';
import CheckIcon from '@mui/icons-material/Check';
import IconButton from "@mui/material/IconButton";
import RestoreIcon from '@mui/icons-material/Restore';
import {green, grey, orange} from "@mui/material/colors";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Typography from "@mui/material/Typography";
import {containerActions, uiActions, useContainerStore} from "./store";

const Cmd = ({cmd, cmdDefault, editing, onChange, onEditing, disabled}) => {
    const inputRef = useRef();

    const handleSubmit = (event) => {
        event.preventDefault();

        onEditing(false);

        let val = inputRef.current.value;
        if (cmdDefault.length === 1 && cmdDefault[0] === val) {
            val = undefined;
        }
        onChange(val);
    };

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
        }
    }, [editing]);

    return (
        <Stack direction="row" spacing={1} component="form" onSubmit={handleSubmit}>
            {(editing || cmd !== undefined) ? (
                <TextField
                    label="Command"
                    size="small"
                    sx={{ width: 400 }}
                    disabled={!editing}
                    inputRef={inputRef}
                />
            ) : (
                <Autocomplete
                    multiple
                    options={cmdDefault}
                    defaultValue={cmdDefault}
                    readOnly
                    freeSolo
                    renderInput={(params) => (
                        <TextField {...params} label="Command" size="small" sx={{ width: 400 }} />
                    )}
                    renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                            <Chip size="small" label={option} {...getTagProps({ index })} />
                        ))
                    }
                    disabled
                />
            )}

            <Box>
                <Stack direction="row">
                    {editing ? (
                        <>
                            <IconButton
                                type="submit"
                                aria-label="confirm"
                                sx={{color: green[500]}}
                            >
                                <CheckIcon />
                            </IconButton>
                            <IconButton
                                onClick={event => {
                                    event.preventDefault();
                                    onEditing(false);
                                }}
                                variant="outlined"
                                aria-label="cancel"
                                color="warning"
                            >
                                <ClearIcon />
                            </IconButton>
                        </>
                    ) : (
                        <>
                            <Tooltip title="Edit">
                                <IconButton
                                    onClick={event => {
                                        event.preventDefault();
                                        onEditing(true);
                                    }}
                                    color="primary"
                                    aria-label="edit"
                                    disabled={disabled}
                                >
                                    <EditIcon />
                                </IconButton>
                            </Tooltip>

                            {cmd !== undefined && (
                                <Tooltip title="Revert to default">
                                    <IconButton
                                        onClick={() => onChange(undefined)}
                                        color="warning"
                                        aria-label="reset"
                                        disabled={disabled}
                                        type="button"
                                    >
                                        <RestoreIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </>

                    )}
                </Stack>
            </Box>


        </Stack>
    );
};

const WorkDir = ({workdir, workdirDefault, editing, onChange, onEditing, disabled}) => {
    const inputRef = useRef();

    const defaultVal = workdir || workdirDefault;
    const [val, setVal] = useState(defaultVal);

    const handleSubmit = (event) => {
        event.preventDefault();

        onEditing(false);

        let cbVal = val;
        if (val === workdirDefault) {
            cbVal = undefined;
        }

        if (!val) {
            setVal(workdirDefault);
            cbVal = undefined;
        }
        onChange(cbVal);
    };

    const handleCancel = event => {
        event.preventDefault();
        setVal(defaultVal);
        onEditing(false);
    };

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
        }
    }, [editing]);

    return (
        <Stack direction="row" spacing={1} component="form" onSubmit={handleSubmit}>
            <TextField
                label="Working directory"
                size="small"
                value={val}
                sx={{ width: 400 }}
                disabled={!editing}
                onChange={event => setVal(event.target.value)}
                inputRef={inputRef}
            />

            <Box>
                <Stack direction="row">
                    {editing ? (
                        <>
                            <IconButton
                                type="submit"
                                aria-label="confirm"
                                sx={{color: green[500]}}
                            >
                                <CheckIcon />
                            </IconButton>
                            <IconButton
                                onClick={handleCancel}
                                variant="outlined"
                                aria-label="cancel"
                                color="warning"
                            >
                                <ClearIcon />
                            </IconButton>
                        </>
                    ) : (
                        <>
                            <Tooltip title="Edit">
                                <IconButton
                                    onClick={event => {
                                        event.preventDefault();
                                        onEditing(true);
                                    }}
                                    color="primary"
                                    aria-label="edit"
                                    disabled={disabled}
                                >
                                    <EditIcon />
                                </IconButton>
                            </Tooltip>

                            {workdir !== undefined && (
                                <Tooltip title="Revert to default">
                                    <IconButton
                                        onClick={() => {
                                            onChange(undefined);
                                            setVal(workdirDefault);
                                        }}
                                        color="warning"
                                        aria-label="reset"
                                        disabled={disabled}
                                        type="button"
                                    >
                                        <RestoreIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </>

                    )}
                </Stack>
            </Box>

        </Stack>
    );
};

function CreateEntrypointCmd({cmd, workDir, imageDetail, onEdited, onConfirm}) {
    const [editCmd, setEditCmd] = useState(cmd);
    const [editWorkDir, setEditWorkDir] = useState(workDir);

    const [editing, setEditing] = useState([false, false]);
    const [version, setVersion] = useState(0);
    const editedVal = useRef(false);

    const anyEditing = useMemo(() => {
        return editing.indexOf(true) !== -1;
    }, [editing]);

    const handleEditing = (i, newVal) => {
        if (editing[i] === newVal) {
            return;
        }
        setEditing(editing.map((oldVal, idx) => {
            if (idx === i) {
                return newVal;
            }
            return oldVal;
        }));
    };

    const handleConfirm = () => {
        onConfirm({
            cmd: editCmd,
            workDir: editWorkDir
        });
    };

    const handleRevert = () => {
        setEditing([false, false]);
        setEditWorkDir(workDir);
        setEditCmd(cmd);
        setVersion(v => v + 1);
    };

    const changed = useMemo(() => {
        return cmd !== editCmd || workDir !== editWorkDir;
    }, [cmd, editCmd, editWorkDir, workDir]);

    useEffect(() => {
        const v = changed || anyEditing;
        if (v !== editedVal.current) {
            onEdited(v);
            editedVal.current = v;
        }
    }, [anyEditing, changed, onEdited]);

    const handleCmdChange = v => {
        setEditCmd(v);
    };

    const handleWorkDirChange = v => {
        setEditWorkDir(v);
    };

    return (
        <Stack spacing={2} key={version}>
            {/*entrypoint, do not edit it, even though possible*/}
            <Autocomplete
                multiple
                options={imageDetail.Config.Entrypoint || []}
                defaultValue={imageDetail.Config.Entrypoint || []}
                readOnly
                freeSolo
                renderInput={(params) => (
                    <TextField {...params} label="Entrypoint" size="small" sx={{ width: 400 }} />
                )}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                        <Chip size="small" label={option} {...getTagProps({ index })} />
                    ))
                }
                disabled
            />

            <Cmd
                cmd={editCmd}
                cmdDefault={imageDetail.Config.Cmd || []}
                editing={editing[0]}
                onChange={handleCmdChange}
                onEditing={v => handleEditing(0, v)}
                disabled={anyEditing && !editing[0]}
            />

            <WorkDir
                workdir={editWorkDir}
                workdirDefault={imageDetail.Config.WorkingDir || '/'}
                imageDetail={imageDetail}
                editing={editing[1]}
                onChange={handleWorkDirChange}
                onEditing={v => handleEditing(1, v)}
                disabled={anyEditing && !editing[1]}
            />

            <Stack direction="row" spacing={1}>
                <Button
                    variant="outlined"
                    disabled={anyEditing}
                    startIcon={<CheckIcon />}
                    onClick={handleConfirm}
                >
                    Confirm
                </Button>

                <Button
                    variant="outlined"
                    disabled={!changed || anyEditing}
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

const accordionIndex = 1;

export default function AccordionEntrypointCmd() {
    const open = useContainerStore(state => state.open[accordionIndex]);
    const disabled = useContainerStore(state => state.disabled[accordionIndex]);
    const edited = useContainerStore(state => state.edited[accordionIndex]);
    const imageDetail = useContainerStore(state => state.imageDetail);
    const version = useContainerStore(state => state.version[accordionIndex]);

    const cmd = useContainerStore(state => state.cmd);
    const workDir = useContainerStore(state => state.workDir);

    const onExpandChange = (event, open) => {
        uiActions.toggle(accordionIndex, open);
    };

    const onEdited = edited => {
        uiActions.setEdited(accordionIndex, edited);
    };

    const onConfirm = p => {
        containerActions.setCmd(p.cmd);
        containerActions.setWorkDir(p.workDir);

        uiActions.openNext(accordionIndex);
    };

    const texts = [];
    if (cmd) {
        texts.push('Command: ' + cmd);
    }
    if (workDir) {
        texts.push('WorkingDirectory: ' + workDir);
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
                aria-controls="panel2a-content"
                id="panel2a-header"
            >
                <Typography sx={{ flexGrow: 1 }}>
                    Entrypoint, Command, and WorkingDirectory
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
                {/* avoid empty imageDetail */}
                {imageDetail && (
                    <CreateEntrypointCmd
                        key={version}
                        cmd={cmd}
                        workDir={workDir}
                        imageDetail={imageDetail}
                        onEdited={onEdited}
                        onConfirm={onConfirm}
                    />
                )}
            </AccordionDetails>
        </Accordion>
    );
}
