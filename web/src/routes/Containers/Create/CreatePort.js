import TextField from "@mui/material/TextField";
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
import IconButton from "@mui/material/IconButton";
import {green, grey, orange} from "@mui/material/colors";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CheckIcon from "@mui/icons-material/Check";
import {useEffect, useMemo, useRef, useState} from "react";
import ClearIcon from "@mui/icons-material/Clear";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RestoreIcon from "@mui/icons-material/Restore";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Typography from "@mui/material/Typography";
import {containerActions, uiActions, useContainerStore} from "./store";

const ipRegex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
const portRegex = /^[1-9][0-9]{0,4}$/;

const getHostAddrPorts = str => {
    const ret = [];
    const parts = str.split(',');
    const portsMap = {};
    for (const part of parts) {
        const ps = part.split(':');
        if (ps.length === 0 || ps.length > 2) {
            return false;
        }

        let portStr = '';
        let addr = '';
        if (ps.length === 1) {
            portStr = ps[0];
        } else {
            [addr, portStr] = ps;
        }

        if (!portStr.match(portRegex)) {
            return false;
        }
        const port = parseInt(portStr);
        if (isNaN(port) || port < 1 || port > 65535) {
            return false;
        }

        if (addr) {
            if (!addr.match(ipRegex)) {
                return false;
            }
        }

        // duplication check
        let checkAddr = '0.0.0.0';
        if (addr) {
            checkAddr = addr;
        }
        const key = checkAddr + ':' + port;
        if (portsMap[key]) {
            return false;
        }
        portsMap[key] = 1;

        ret.push({
            addr,
            port
        });
    }
    return ret;
};

const generateHostStr = port => {
    const parts = [];
    for (const host of port.host) {
        let str = "";
        if (host.addr) {
            str = host.addr + ":";
        }
        str += host.port;
        parts.push(str);
    }
    return parts.join(',');
};

const Port = ({port, editing, onChange, onEditing, onDelete, disabled}) => {
    const inputRefContainer = useRef();
    const inputRefHost = useRef();

    const [editPort, setEditPort] = useState(port);

    const [containerPort, setContainerPort] = useState(port.container ? port.container + '' : '');
    const [invalidContainer, setInvalidContainer] = useState(false);

    const [hostAddrPorts, setHostAddrPorts] = useState(() => generateHostStr(port));
    const [invalidHost, setInvalidHost] = useState(false);

    const [dupValContainer, setDupValContainer] = useState(0);
    const [dupValHost, setDupValHost] = useState('');

    const handleSubmit = event => {
        event.preventDefault();

        // empty values
        let empty = false;
        if (!containerPort) {
            setInvalidContainer(true);
            inputRefContainer.current?.focus();
            empty = true;
        }
        if (!hostAddrPorts) {
            setInvalidHost(true);
            if (!empty) {
                inputRefHost.current?.focus();
                empty = true;
            }
        }
        if (empty) {
            return;
        }

        if (invalidContainer || invalidHost) {
            if (invalidContainer) {
                inputRefContainer.current?.focus();
            } else if (invalidHost) {
                inputRefHost.current?.focus();
            }
            return;
        }

        const [okContainer, dupHostVal] = onChange(editPort);
        if (!okContainer) {
            setDupValContainer(editPort.container);
            setInvalidContainer(true);
            return;
        }
        if (dupHostVal) {
            setDupValHost(dupHostVal);
            setInvalidHost(true);
            return;
        }

        setDupValContainer(0);
        onEditing(false);
    };

    const handleCancel = event => {
        event.preventDefault();

        if (!port.container && !port.host.length) {
            onDelete();
            return;
        }

        setInvalidContainer(false);
        setInvalidHost(false);

        setEditPort(port);
        setHostAddrPorts(generateHostStr(port));
        setDupValContainer(undefined);
        setDupValHost(0);
        onEditing(false);
    };

    const handleContainerChange = event => {
        const str = event.target.value;
        setContainerPort(str);
        setDupValContainer(0);
        if (!str.match(portRegex)) {
            setInvalidContainer(true);
            return;
        }

        const port = parseInt(str);
        if (isNaN(port) || port < 1 || port > 65535) {
            setInvalidContainer(true);
            return;
        }

        setInvalidContainer(false);
        setEditPort({
            ...editPort,
            container: port
        });
    };

    const handleHostChange = event => {
        setHostAddrPorts(event.target.value);
        setDupValHost('');
        const result = getHostAddrPorts(event.target.value);
        if (result) {
            setEditPort({
                ...editPort,
                host: result
            });
        }
        setInvalidHost(!result);
    };

    useEffect(() => {
        if (editing) {
            if (port.predefined) {
                inputRefHost.current?.focus();
                return;
            }

            if (!port.container) {
                inputRefContainer.current?.focus();
            }
        }
    }, [editing, port]);

    let helperTextContainer = port.predefined && editing ? 'Predefined by image' : '';
    if (!helperTextContainer) {
        if (dupValContainer) {
            helperTextContainer = 'Duplicated port';
        }
    }

    let helperTextHost = '';
    if (!helperTextHost) {
        if (dupValHost) {
            helperTextHost = 'Duplicated port ' + dupValHost;
        }
    }
    if (!helperTextHost) {
        helperTextHost = port.predefined && editing ? 'Leave empty to ignore' : '';
    }

    return (
        <Stack direction="row" spacing={1} component="form" onSubmit={handleSubmit}>
            <TextField
                label="Container port"
                size="small"
                value={containerPort}
                sx={{ width: 150 }}
                disabled={!editing || port.predefined}
                onChange={handleContainerChange}
                error={invalidContainer}
                inputRef={inputRefContainer}
                helperText={helperTextContainer}
            />

            <Box>
                <Select
                    size="small"
                    sx={{width: '100px'}}
                    value={editPort.protocol}
                    disabled={!editing || editPort.predefined}
                    onChange={event => setEditPort({
                        ...editPort,
                        protocol: event.target.value
                    })}
                >
                    <MenuItem value="tcp">TCP</MenuItem>
                    <MenuItem value="udp">UDP</MenuItem>
                </Select>
            </Box>

            <TextField
                label="Host port"
                size="small"
                value={hostAddrPorts}
                sx={{ width: '200px' }}
                disabled={!editing}
                onChange={handleHostChange}
                error={invalidHost}
                inputRef={inputRefHost}
                helperText={helperTextHost}
            />

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

                        {!port.predefined && (
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

function CreatePort({ports, imageDetail, onEdited, onConfirm}) {
    const [editPorts, setEditPorts] = useState(ports);
    const editingGenerator = () => {
        const map = {};
        let total = ports.length;

        // predefined volumes + customized volumes. deduplicated
        // length === combinedVolumes.length
        ports.forEach((v, i) => {
            map[v.container + '/' + v.protocol] = i;
        });
        if (imageDetail.Config.ExposedPorts) {
            Object.keys(imageDetail.Config.ExposedPorts).forEach(containerPortProto => {
                if (map[containerPortProto] === undefined) {
                    total += 1;
                }
            });
        }
        return [...Array(total)].map(() => false);
    };
    const [editing, setEditing] = useState(editingGenerator);
    const [version, setVersion] = useState(0);
    const editedVal = useRef(false);

    const combinedPorts = useMemo(() => {
        const ret = [];
        const map = {};
        // predefined ports first
        if (imageDetail.Config.ExposedPorts) {
            Object.keys(imageDetail.Config.ExposedPorts).forEach((containerPortProto, i) => {
                const [containerPort, protocol] = containerPortProto.split('/');
                ret.push({
                    container: parseInt(containerPort),
                    host: [],
                    protocol: protocol,
                    predefined: true
                });
                map[containerPortProto] = i;
            });
        }
        // then customized volumes
        for (const v of editPorts) {
            const mapIdx = map[v.container + '/' + v.protocol];
            if (mapIdx !== undefined) {
                ret[mapIdx] = v;
                continue;
            }
            ret.push(v);
        }
        return ret;
    }, [editPorts, imageDetail]);

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
        const hostPortMap = {};
        combinedPorts.forEach((port, idx) => {
            combinedMap[port.container + '/' + port.protocol] = idx;

            if (idx !== i) {
                for (const host of port.host) {
                    let addr = '0.0.0.0';
                    if (host.addr) {
                        addr = host.addr;
                    }
                    hostPortMap[addr + ':' + host.port + '/' + port.protocol] = 1;
                }
            }
        });

        const myIdx = combinedMap[newVal.container + '/' + newVal.protocol];
        if (myIdx !== i && myIdx !== undefined) {
            // The key points to another row? Duplication!
            return [false, 0];
        }

        // duplicated host ports
        for (const host of newVal.host) {
            let addr = '0.0.0.0';
            if (host.addr) {
                addr = host.addr;
            }
            const exist = hostPortMap[addr + ':' + host.port + '/' + newVal.protocol];
            if (exist) {
                return [true, host.addr ? host.addr + ':' + host.port : host.port + ''];
            }
        }

        // replace the dirty item, or copy clean items
        const newPorts = [];
        combinedPorts.forEach((port, idx) => {
            if (idx === i) {
                if (!newVal.predefined || newVal.host.length) {
                    // remove predefined but ignored volume
                    newPorts.push(newVal);
                }
            } else {
                if (port.container && port.host.length) {
                    newPorts.push(port);
                }
            }
        });

        setEditPorts(newPorts);
        return [true, 0];
    };

    const handleDelete = i => {
        // We edit editVolumes, instead of combinedVolumes. So we need the correct index.
        let volumeIndex = i;
        for (const port of combinedPorts) {
            if (!port.predefined) {
                break;
            }
            if (!port.host.length) {
                volumeIndex -= 1;
            }
        }

        setEditPorts(editPorts.filter((v, idx) => {
            return idx !== volumeIndex;
        }));
        setEditing(editing.filter((v, idx) => {
            return idx !== i;
        }));
    };


    const handleConfirm = () => {
        onConfirm(editPorts);
        onEdited(false);
        editedVal.current = false;
    };

    const handleRevert = () => {
        setEditing(editingGenerator);
        setEditPorts(ports);
        setVersion(v => v + 1);
    };

    const changed = useMemo(() => {
        let c = ports.length !== editPorts.length;
        if (!c) {
            for (let i = 0; i < ports.length; i ++) {
                const [a, b] = [ports[i], editPorts[i]];

                for (const key of Object.keys(a)) {
                    if (a[key] !== b[key]) {
                        c = true;
                        break;
                    }
                }
            }
        }
        return c;
    }, [editPorts, ports]);

    useEffect(() => {
        const v = changed || anyEditing;
        if (v !== editedVal.current) {
            onEdited(v);
            editedVal.current = v;
        }
    }, [anyEditing, changed, onEdited]);

    const handleAdd = () => {
        setEditPorts([...editPorts, {
            container: 0,
            host: [],
            protocol: 'tcp'
        }]);
        setEditing([...editing, true]);
    };

    return (
        <Stack spacing={3} key={version}>
            {combinedPorts.map((v, i) => (
                <Port
                    key={i + '/' + v.container + '/' + v.protocol}
                    port={v}
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

const accordionIndex = 4;

export default function AccordionPort() {
    const open = useContainerStore(state => state.open[accordionIndex]);
    const disabled = useContainerStore(state => state.disabled[accordionIndex]);
    const edited = useContainerStore(state => state.edited[accordionIndex]);
    const imageDetail = useContainerStore(state => state.imageDetail);
    const version = useContainerStore(state => state.version[accordionIndex]);

    const ports = useContainerStore(state => state.ports);

    const onExpandChange = (event, open) => {
        uiActions.toggle(accordionIndex, open);
    };

    const onEdited = edited => {
        uiActions.setEdited(accordionIndex, edited);
    };

    const onConfirm = p => {
        containerActions.setPorts(p);

        uiActions.openNext(accordionIndex);
    };

    return (
        <Accordion
            expanded={open}
            onChange={onExpandChange}
            disabled={disabled}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="panel5a-content"
                id="panel5a-header"
            >
                <Typography sx={{ flexGrow: 1 }}>
                    Ports
                </Typography>
                {edited && open && (
                    <Typography sx={{color: orange[500]}}>
                        Not saved yet
                    </Typography>
                )}
                {!disabled && !open && ports.length > 0 && (
                    <Typography sx={{color: grey[500]}}>
                        {ports.length} port{ports.length > 1 && 's'}
                    </Typography>
                )}
            </AccordionSummary>
            <AccordionDetails>
                {/* avoid empty imageDetail */}
                {imageDetail && (
                    <CreatePort
                        key={version}
                        ports={ports}
                        imageDetail={imageDetail}
                        onEdited={onEdited}
                        onConfirm={onConfirm}
                    />
                )}
            </AccordionDetails>
        </Accordion>
    );
}
