import IconButton from "@mui/material/IconButton";
import {Box, Menu, MenuItem, Tooltip} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ListItemIcon from "@mui/material/ListItemIcon";
import SaveIcon from "@mui/icons-material/Save";
import ListItemText from "@mui/material/ListItemText";
import {green, orange, red, yellow} from "@mui/material/colors";
import DeleteIcon from "@mui/icons-material/Delete";
import {useCallback, useEffect, useState} from "react";
import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {getController} from "../../../lib/HostGuestController";
import dataModel from "../../../lib/dataModel";
import {enqueueSnackbar} from "notistack";
import {useLocation, useNavigate} from "react-router-dom";
import ContainerDialogRemove from "../List/ContainerDialogRemove";
import ContainerDialogCommit from "../List/ContainerDialogCommit";

const getStatusText = c => {
    if (!c || !c.State) {
        return {text: '', color: '#555'};
    }
    switch (c.State.Status) {
        case 'running': {
            return {
                text: 'UP',
                color: green[400],
                canStart: false,
                canStop: true,
                canCommit: false,
                canRemove: false
            };
        }
        case 'exited': {
            return {
                text: `EXITED (${c.State.ExitCode})`,
                color: red[500],
                canStart: true,
                canStop: false,
                canCommit: true,
                canRemove: true
            };
        }
        case 'created': {
            return {
                text: 'CREATED',
                color: yellow[900],
                canStart: true,
                canStop: false,
                canCommit: true,
                canRemove: true
            };
        }
        case 'paused': {
            return {
                text: 'PAUSED',
                color: yellow[900],
                canStart: false,
                canStop: false,
                canCommit: false,
                canRemove: false
            };
        }
        default: {
            return {text: c.State.Status, color: '#555'};
        }
    }
};

export default function ContainerDetailButtons() {
    const navigate = useNavigate();
    const {pathname} = useLocation();

    const [container, setContainer] = useState(null);
    const [dialogRemoveOpen, setDialogRemoveOpen] = useState(false);
    const [dialogCommitOpen, setDialogCommitOpen] = useState(false);

    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const menuOpen = Boolean(menuAnchorEl);

    const [actioning, setActioning] = useState(false);
    const [action, setAction] = useState('');

    const handleClickMenuButton = event => {
        setMenuAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchorEl(null);
    };

    useEffect(() => {
        const ctrl = getController('container_detail_buttons');
        const hostSide = ctrl.asControllerHost();
        const hostSideOnReceive = hostSide.useOnReceive();

        hostSideOnReceive(c => {
            if (!c) {
                c = null;
                return;
            }
            setContainer(c);
        });
        return () => hostSideOnReceive(null);
    }, []);

    const handleClickStart = () => {
        setMenuAnchorEl(null);
        setAction('start');
        setActioning(true);
    };

    const handleClickStop = () => {
        setMenuAnchorEl(null);
        setAction('stop');
        setActioning(true);
    };

    const handleClickCommit = () => {
        setMenuAnchorEl(null);
        setDialogCommitOpen(true);
    };

    const handleClickRemove = () => {
        setMenuAnchorEl(null);
        setAction('remove');
        setDialogRemoveOpen(true);
    };

    useEffect(() => {
        if (!actioning) {
            return;
        }

        const ac = new AbortController();
        dataModel.containerAction(container.Id.substring(0, 12), {action}, ac)
            .then(() => {
                setDialogRemoveOpen(false);

                let actionTypeText = '';
                switch (action) {
                    case 'start': {
                        actionTypeText = 'started';
                        break;
                    }
                    case 'remove': {
                        actionTypeText = 'removed';
                        break;
                    }
                    case 'stop': {
                        actionTypeText = 'stopped';
                        break;
                    }
                    default:
                }
                const msg = (<span>
                    Container <b>{container.Name}</b> ({container.Id.substring(0, 12)}) {actionTypeText}.
                </span>);
                enqueueSnackbar(msg, {
                    variant: 'success'
                });

                if (action === 'remove') {
                    navigate('/containers');
                }
            })
            .catch(err => {
                if (ac.signal.aborted) {
                    return;
                }
                if (dataModel.errIsNoLogin(err)) {
                    let query = new URLSearchParams();
                    query.append('cb', pathname);
                    navigate('/login?' + query.toString());
                    return;
                }
                let errStr = err.toString();
                if (err.response) {
                    errStr = err.response.data;
                }
                enqueueSnackbar(errStr, {
                    variant: 'error'
                });
            })
            .finally(() => {
                if (ac.signal.aborted) {
                    return;
                }
                setActioning(false);
            });

        return () => ac.abort();
    }, [actioning, container, navigate, pathname, action]);

    const handleDialogCommitClose = useCallback(() => {
        setDialogCommitOpen(false);
    }, []);

    const st = getStatusText(container);

    if (!container) {
        return (
            <></>
        );
    }

    return (
        <>
            {container && (
                <>
                    <ContainerDialogRemove
                        containerName={container.Name}
                        containerIdShort={container.Id.substring(0, 12)}
                        actioning={dialogRemoveOpen && actioning}
                        open={dialogRemoveOpen}
                        onClose={() => setDialogRemoveOpen(false)}
                        onConfirm={() => setActioning(true)}
                    />

                    <ContainerDialogCommit
                        open={dialogCommitOpen}
                        containerName={container.Name}
                        containerIdShort={container.Id.substring(0, 12)}
                        onClose={handleDialogCommitClose}
                    />
                </>
            )}

            <Box sx={{display: 'flex'}}>
                <Box sx={{
                    padding: '4px 8px',
                    margin: '4px',
                    borderRadius: '10px',
                    backgroundColor: '#e7cbeb',
                    fontWeight: 450,
                    color: st.color
                }}>
                    {st.text}
                </Box>
                <Tooltip title="Actions">
                    <IconButton
                        aria-label="actions"
                        onClick={handleClickMenuButton}
                        color="inherit"
                    >
                        <MoreVertIcon />
                    </IconButton>
                </Tooltip>
                <Menu
                    anchorEl={menuAnchorEl}
                    open={menuOpen}
                    onClose={handleCloseMenu}
                    MenuListProps={{
                        'aria-labelledby': 'basic-button',
                    }}
                >
                    <MenuItem
                        disabled={actioning || !st.canStart}
                        onClick={handleClickStart}
                    >
                        <ListItemIcon sx={{color: green[500]}}>
                            <PlayArrowIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>
                            Start
                        </ListItemText>
                    </MenuItem>

                    <MenuItem
                        disabled={actioning || !st.canStop}
                        onClick={handleClickStop}
                    >
                        <ListItemIcon sx={{color: red[900]}}>
                            <StopIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>
                            Stop
                        </ListItemText>
                    </MenuItem>

                    <MenuItem
                        disabled={actioning || !st.canCommit}
                        onClick={handleClickCommit}
                    >
                        <ListItemIcon>
                            <SaveIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>
                            Commit
                        </ListItemText>
                    </MenuItem>

                    <MenuItem
                        disabled={actioning || !st.canRemove}
                        onClick={handleClickRemove}
                    >
                        <ListItemIcon sx={{color: orange[300]}}>
                            <DeleteIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>
                            Remove
                        </ListItemText>
                    </MenuItem>

                </Menu>
            </Box>
        </>
    );
}