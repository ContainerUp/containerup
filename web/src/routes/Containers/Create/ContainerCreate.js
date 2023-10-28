import {Alert, Box, Button, Stack} from "@mui/material";
import {useEffect, useState} from "react";
import {getController} from "../../../lib/HostGuestController";
import AccordionNameImage from "./CreateNameImage";
import {getImageNameFromInspection} from "../../../lib/imageUtil";
import AccordionEntrypointCmd from "./CreateEntrypointCmd";
import AccordionEnvironment from "./CreateEnvironment";
import AccordionVolume from "./CreateVolume";
import AccordionPort from "./CreatePort";
import dataModel from "../../../lib/dataModel";
import {useNavigate} from "react-router-dom";
import {enqueueSnackbar} from "notistack";
import AccordionAdv from "./CreateAdv";
import DialogDiscard from "./DialogDiscard";
import CheckIcon from "@mui/icons-material/Check";
import AccordionResources from "./CreateResources";
import {unstable_usePrompt as usePrompt} from "react-router-dom";
import {containerActions, uiActions, useContainerStore} from "./store";

const CreateAction = () => {
    const navigate = useNavigate();
    const [errMsg, setErrMsg] = useState('');
    const [creating, setCreating] = useState(false);

    const imageDetail = useContainerStore(state => state.imageDetail);
    const anyEdited = useContainerStore(state => {
        return state.edited.indexOf(true) !== -1;
    });

    usePrompt({
        when: !!imageDetail && !creating,
        message: 'You have unsaved data. Do you really want to leave?'
    });
    useEffect(() => {
        function block(event) {
            if (!!imageDetail && !creating) {
                event.preventDefault();
                return event.returnValue = "";
            }
        }
        window.addEventListener('beforeunload', block);
        return () => window.removeEventListener('beforeunload', block);
    }, [creating, imageDetail]);

    const handleCreate = () => {
        setCreating(true);
        setErrMsg('');
    };

    useEffect(() => {
        if (!creating) {
            return;
        }

        const {name, imageDetail, cmd, workDir, envs, volumes, ports, res, adv} = useContainerStore.getState();

        const envMap = {};
        for (const e of envs) {
            envMap[e.name] = e.value;
        }

        const ac = new AbortController();
        dataModel.containerCreate({
            name: name,
            image: getImageNameFromInspection(imageDetail),
            command: cmd,
            workDir: workDir,
            env: envMap,
            volumes: volumes.map(v => {
                return {
                    container: v.container,
                    host: v.host,
                    readWrite: v.rw
                };
            }),
            ports: ports.map(p => {
                return {
                    container: p.container,
                    host: p.host,
                    protocol: p.protocol
                };
            }),
            resources: res,
            start: adv.start,
            alwaysRestart: adv.alwaysRestart
        }, ac)
            .then(data => {
                navigate('/containers');
                const msg = (<span>
                    Container <b>{name}</b> ({data.Id.substring(0, 12)}) has been created.
                </span>);
                enqueueSnackbar(msg, {variant: 'success'});
                if (data.StartErr) {
                    enqueueSnackbar(data.StartErr, {variant: 'error'});
                }
            })
            .catch(error => {
                if (ac.signal.aborted) {
                    return;
                }

                let errStr = error.toString();
                if (dataModel.errIsNoLogin(error)) {
                    errStr = 'Session expired. Reload the page, and try again.';
                } else {
                    if (error.response) {
                        errStr = error.response.data;
                    }
                }

                setErrMsg(errStr);
            })
            .finally(() => {
                if (ac.signal.aborted) {
                    return;
                }
                setCreating(false);
            });

        return () => ac.abort();
    }, [creating, navigate]);

    return (
        <Box sx={{mt: '20px'}}>
            <Stack spacing={3}>
                {!!errMsg && (
                    <Alert severity="error">
                        {errMsg}
                    </Alert>
                )}

                <Box>
                    <Button
                        variant="outlined"
                        startIcon={<CheckIcon />}
                        disabled={creating || !imageDetail || anyEdited}
                        onClick={handleCreate}>
                        Create
                    </Button>
                </Box>
            </Stack>
        </Box>
    );
};

export default function ContainerCreate() {
    // breadcrumb
    useEffect(() => {
        const ctrl = getController('bar_breadcrumb');
        const unregister = ctrl.asControllerGuest([{
            text: 'Containers',
            href: '/containers'
        }, {
            text: 'Create'
        }]);
        return () => unregister();
    }, []);

    useEffect(() => {
        document.title = 'ContainerUp - Create a container';

        return () => {
            uiActions.reset();
            containerActions.reset();
        };
    }, []);

    return (
        <Box sx={{margin: "0 36px"}}>
            <AccordionNameImage />

            <AccordionEntrypointCmd />

            <AccordionEnvironment />

            <AccordionVolume />

            <AccordionPort />

            <AccordionResources />

            <AccordionAdv />

            <DialogDiscard />

            <CreateAction />
        </Box>
    );
}