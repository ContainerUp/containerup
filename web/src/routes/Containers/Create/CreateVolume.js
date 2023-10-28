import {useEffect, useMemo, useRef, useState} from "react";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    MenuItem,
    Select,
    Stack,
    Tooltip
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import {green, grey, orange} from "@mui/material/colors";
import ClearIcon from "@mui/icons-material/Clear";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RestoreIcon from "@mui/icons-material/Restore";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Typography from "@mui/material/Typography";
import {containerActions, uiActions, useContainerStore} from "./store";

const Volume = ({volume, editing, onChange, onEditing, onDelete, disabled}) => {
    const inputRefContainer = useRef();
    const inputRefHost = useRef();
    const [editVolume, setEditVolume] = useState(volume);
    const [dupVal, setDupVal] = useState(undefined);

    const [touchedContainer, setTouchedContainer] = useState(false);
    const invalidContainer = useMemo(() => {
        const val = editVolume.container;
        return !val || val.length === 1 || val[0] !== '/' || val === dupVal;
    }, [dupVal, editVolume]);

    const [touchedHost, setTouchedHost] = useState(false);
    const invalidHost = useMemo(() => {
        const val = editVolume.host;
        if (!val) {
            return !editVolume.predefined;
        }
        return val.length === 1 || val[0] !== '/';
    }, [editVolume]);

    const handleChangeContainer = event => {
        const val = event.target.value;
        setEditVolume({
            ...editVolume,
            container: val
        });
        setTouchedContainer(true);
    };

    const handleChangeHost = event => {
        const val = event.target.value;
        setEditVolume({
            ...editVolume,
            host: val
        });
        setTouchedHost(true);
    };

    const handleSubmit = event => {
        event.preventDefault();

        setTouchedContainer(true);
        setTouchedHost(true);

        if (invalidContainer || invalidHost) {
            if (invalidContainer) {
                inputRefContainer.current?.focus();
            } else if (invalidHost) {
                inputRefHost.current?.focus();
            }
            return;
        }

        const ok = onChange(editVolume);
        if (!ok) {
            setDupVal(editVolume.container);
            return;
        }

        setDupVal(undefined);
        onEditing(false);
    };

    const handleCancel = event => {
        event.preventDefault();

        if (!volume.container && !volume.host) {
            onDelete();
            return;
        }

        setEditVolume(volume);
        onEditing(false);
    };

    useEffect(() => {
        if (editing) {
            if (volume.predefined) {
                inputRefHost.current?.focus();
                return;
            }

            if (!volume.container) {
                inputRefContainer.current?.focus();
            }
        }
    }, [editing, volume]);

    let helperTextContainer = volume.predefined && editing ? 'Predefined by image' : '';
    if (!helperTextContainer) {
        if (editVolume.container === dupVal) {
            helperTextContainer = 'Duplicated location';
        }
    }

    return (
        <Stack direction="row" spacing={1} component="form" onSubmit={handleSubmit}>
            <TextField
                label="Container location"
                size="small"
                value={editVolume.container}
                sx={{ width: '250px' }}
                disabled={!editing || volume.predefined}
                onChange={handleChangeContainer}
                error={invalidContainer && touchedContainer}
                inputRef={inputRefContainer}
                helperText={helperTextContainer}
            />

            <TextField
                label="Host location"
                size="small"
                value={editVolume.host}
                sx={{ width: '250px' }}
                disabled={!editing}
                onChange={handleChangeHost}
                error={invalidHost && touchedHost}
                inputRef={inputRefHost}
                helperText={volume.predefined && editing ? 'Leave empty to ignore' : ''}
            />

            <Box>
                <Select
                    size="small"
                    sx={{width: '150px'}}
                    value={editVolume.rw}
                    disabled={!editing}
                    onChange={event => setEditVolume({
                        ...editVolume,
                        rw: event.target.value
                    })}
                >
                    <MenuItem value="ro">Read-only</MenuItem>
                    <MenuItem value="rw">Read-write</MenuItem>
                </Select>
            </Box>

            <Box>
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
                                type="button"
                            >
                                <EditIcon />
                            </IconButton>
                        </Tooltip>

                        {!volume.predefined && (
                            <Tooltip title="Remove">
                                <IconButton
                                    onClick={event => {
                                        event.preventDefault();
                                        onDelete();
                                    }}
                                    color="warning"
                                    aria-label="remove"
                                    disabled={disabled}
                                    type="button"
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </>
                )}
            </Box>

        </Stack>
    );
};

function CreateVolume({volumes, imageDetail, onEdited, onConfirm}) {
    const [editVolumes, setEditVolumes] = useState(volumes);
    const editingGenerator = () => {
        const map = {};
        let total = volumes.length;

        // predefined volumes + customized volumes. deduplicated
        // length === combinedVolumes.length
        volumes.forEach((v, i) => {
            map[v.container] = i;
        });
        if (imageDetail.Config.Volumes) {
            Object.keys(imageDetail.Config.Volumes).forEach(containerDir => {
                if (map[containerDir] === undefined) {
                    total += 1;
                }
            });
        }
        return [...Array(total)].map(() => false);
    };
    const [editing, setEditing] = useState(editingGenerator);
    const [version, setVersion] = useState(0);
    const editedVal = useRef(false);

    const combinedVolumes = useMemo(() => {
        const ret = [];
        const map = {};
        // predefined volumes first
        if (imageDetail.Config.Volumes) {
            Object.keys(imageDetail.Config.Volumes).forEach((containerDir, i) => {
                ret.push({
                    container: containerDir,
                    host: '',
                    rw: 'rw',
                    predefined: true
                });
                map[containerDir] = i;
            });
        }
        // then customized volumes
        for (const v of editVolumes) {
            const mapIdx = map[v.container];
            if (mapIdx !== undefined) {
                ret[mapIdx] = v;
                continue;
            }
            ret.push(v);
        }
        return ret;
    }, [editVolumes, imageDetail]);

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

    const handleChange = (i, newVal) => {
        // To find the correct index, build a map first
        const combinedMap = {};
        combinedVolumes.forEach((volume, idx) => {
            combinedMap[volume.container] = idx;
        });

        const myIdx = combinedMap[newVal.container];
        if (myIdx !== i && myIdx !== undefined) {
            // The key points to another row? Duplication!
            return false;
        }

        // replace the dirty item, or copy clean items
        const newVolumes = [];
        combinedVolumes.forEach((volume, idx) => {
            if (idx === i) {
                if (!newVal.predefined || newVal.host) {
                    // remove predefined but ignored volume
                    newVolumes.push(newVal);
                }
            } else {
                if (volume.container && volume.host) {
                    newVolumes.push(volume);
                }
            }
        });

        setEditVolumes(newVolumes);
        return true;
    };

    const handleDelete = i => {
        // We edit editVolumes, instead of combinedVolumes. So we need the correct index.
        let volumeIndex = i;
        for (const volume of combinedVolumes) {
            if (!volume.predefined) {
                break;
            }
            if (!volume.host) {
                volumeIndex -= 1;
            }
        }

        setEditVolumes(editVolumes.filter((v, idx) => {
            return idx !== volumeIndex;
        }));
        setEditing(editing.filter((v, idx) => {
            return idx !== i;
        }));
    };

    const handleConfirm = () => {
        onConfirm(editVolumes);
        onEdited(false);
        editedVal.current = false;
    };

    const handleRevert = () => {
        setEditing(editingGenerator); // todo fix
        setEditVolumes(volumes);
        setVersion(v => v + 1);
    };

    const changed = useMemo(() => {
        let c = volumes.length !== editVolumes.length;
        if (!c) {
            for (let i = 0; i < volumes.length; i ++) {
                const [a, b] = [volumes[i], editVolumes[i]];

                for (const key of Object.keys(a)) {
                    if (a[key] !== b[key]) {
                        c = true;
                        break;
                    }
                }
            }
        }
        return c;
    }, [editVolumes, volumes]);

    useEffect(() => {
        const v = changed || anyEditing;
        if (v !== editedVal.current) {
            onEdited(v);
            editedVal.current = v;
        }
    }, [anyEditing, changed, onEdited]);

    const handleAdd = () => {
        setEditVolumes([...editVolumes, {
            container: '',
            host: '',
            rw: 'rw'
        }]);
        setEditing([...editing, true]);
    };

    return (
        <Stack spacing={3} key={version}>
            {combinedVolumes.map((v, i) => (
                <Volume
                    key={i + '/' + v.container}
                    volume={v}
                    editing={editing[i]}
                    onEditing={v => handleEditing(i, v)}
                    onChange={v => handleChange(i, v)}
                    onDelete={() => handleDelete(i)}
                    disabled={anyEditing && !editing[i]}
                />
            ))}

            <Box>
                <Tooltip title="Add">
                    <IconButton
                        aria-label="add"
                        sx={{color: green[500]}}
                        disabled={anyEditing}
                        onClick={handleAdd}
                    >
                        <AddCircleOutlineIcon />
                    </IconButton>
                </Tooltip>
            </Box>

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

const accordionIndex = 3;

export default function AccordionVolume() {
    const open = useContainerStore(state => state.open[accordionIndex]);
    const disabled = useContainerStore(state => state.disabled[accordionIndex]);
    const edited = useContainerStore(state => state.edited[accordionIndex]);
    const imageDetail = useContainerStore(state => state.imageDetail);
    const version = useContainerStore(state => state.version[accordionIndex]);

    const volumes = useContainerStore(state => state.volumes);

    const handleChangeAccordion = (event, open) => {
        uiActions.toggle(accordionIndex, open);
    };

    const handleEdited = edited => {
        uiActions.setEdited(accordionIndex, edited);
    };

    const handleConfirm = p => {
        containerActions.setVolumes(p);

        uiActions.openNext(accordionIndex);
    };

    return (
        <Accordion
            expanded={open}
            onChange={handleChangeAccordion}
            disabled={disabled}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="panel4a-content"
                id="panel4a-header"
            >
                <Typography sx={{ flexGrow: 1 }}>
                    Volumes
                </Typography>
                {edited && open && (
                    <Typography sx={{color: orange[500]}}>
                        Not saved yet
                    </Typography>
                )}
                {!disabled && !open && volumes.length > 0 && (
                    <Typography sx={{color: grey[500]}}>
                        {volumes.length} volume{volumes.length > 1 && 's'}
                    </Typography>
                )}
            </AccordionSummary>
            <AccordionDetails>
                {/* avoid empty imageDetail */}
                {imageDetail && (
                    <CreateVolume
                        key={version}
                        volumes={volumes}
                        imageDetail={imageDetail}
                        onEdited={handleEdited}
                        onConfirm={handleConfirm}
                    />
                )}
            </AccordionDetails>
        </Accordion>
    );
}
