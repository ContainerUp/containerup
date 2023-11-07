import {useLocation, useNavigate, useOutletContext} from "react-router-dom";
import {useEffect, useMemo, useRef, useState} from "react";
import TextField from "@mui/material/TextField";
import {Stack, Tooltip} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import {green} from "@mui/material/colors";
import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import dataModel from "../../../../lib/dataModel";
import {enqueueSnackbar} from "notistack";

export default function SettingName() {
    const navigate = useNavigate();
    const location = useLocation();
    const {container} = useOutletContext();

    const [name, setName] = useState(container.Name || '');
    const [editing, setEditing] = useState(false);
    const inputRef = useRef();
    const [firstTry, setFirstTry] = useState(false);
    const [renaming, setRenaming] = useState(false);

    const handleRenameSubmit = event => {
        event.preventDefault();
    };

    const handleChangeName = event => {
        setName(event.target.value);
    };

    useEffect(() => {
        setName(container.Name || '');
    }, [container]);

    const handleClickEdit = () => {
        setEditing(true);
        setName('');
        setFirstTry(true);
    };

    const invalidRename = useMemo(() => {
        if (!name && !firstTry) {
            return true;
        }
        return false;
    }, [name, firstTry]);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
        }
    }, [editing]);

    const handleClickCancel = () => {
        setEditing(false);
        setName(container.Name || '');
    };

    const handleClickConfirm = () => {
        if (!name) {
            setFirstTry(false);
            inputRef.current?.focus();
            return;
        }
        setRenaming(true);
    };

    useEffect(() => {
        if (!renaming) {
            return;
        }

        const ac = new AbortController();

        dataModel.containerRename(container.Id, name, ac)
            .then(() => {
                const shortId = container.Id.substring(0, 12);
                const msg = (
                    <span>
                        Container <b>{shortId}</b> has been renamed to <b>{name}</b>.
                    </span>
                );
                enqueueSnackbar(msg, {
                    variant: 'success'
                });
                setEditing(false);
            })
            .catch(error => {
                if (ac.signal.aborted) {
                    return;
                }
                if (dataModel.errIsNoLogin(error)) {
                    let query = new URLSearchParams();
                    query.append('cb', location.pathname + location.search);
                    navigate('/login?' + query.toString());
                    return;
                }
                let errStr = error.toString();
                if (error.response) {
                    errStr = error.response.data;
                }
                enqueueSnackbar(errStr, {
                    variant: 'error'
                });
            })
            .finally(() => {
                if (ac.signal.aborted) {
                    return;
                }
                setRenaming(false);
            });

        return () => {
            ac.abort();
        };
    }, [container, location, name, navigate, renaming]);

    return (
        <Stack direction="row" spacing={2} component="form" onSubmit={handleRenameSubmit}>
            <TextField
                label="Name"
                size="small"
                sx={{width: 200}}
                value={name}
                onChange={handleChangeName}
                disabled={!editing || renaming}
                inputRef={inputRef}
                error={invalidRename}
            />

            <Stack direction="row" spacing={1}>
                {!editing && (
                    <Tooltip title="Rename">
                        <IconButton
                            aria-label="rename"
                            onClick={handleClickEdit}
                        >
                            <DriveFileRenameOutlineIcon />
                        </IconButton>
                    </Tooltip>
                )}

                {editing && (
                    <>
                        <IconButton
                            type="submit"
                            aria-label="confirm"
                            sx={{color: green[500]}}
                            onClick={handleClickConfirm}
                            disabled={renaming}
                        >
                            <CheckIcon />
                        </IconButton>
                        <IconButton
                            onClick={handleClickCancel}
                            variant="outlined"
                            aria-label="cancel"
                            color="warning"
                            disabled={renaming}
                        >
                            <ClearIcon />
                        </IconButton>
                    </>
                )}
            </Stack>

        </Stack>
    );
}