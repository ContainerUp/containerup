import {useNavigate, useParams} from "react-router-dom";
import {Fragment, useCallback, useEffect, useState} from "react";
import dataModel from "../../../lib/dataModel";
import {Alert, Paper, Skeleton} from "@mui/material";
import {getController} from "../../../lib/HostGuestController";

export default function ImageDetail() {
    const {imageId} = useParams();

    const [errMsg, setErrMsg] = useState('');
    const navigate = useNavigate();
    const [inspectData, setInspectData] = useState('');
    const [loading, setLoading] = useState(true);

    const loadInspectData = useCallback(( ac) => {
        setErrMsg('');

        dataModel.imageInspect(imageId, true, ac)
            .then(resp => {
                const str = JSON.stringify(resp, null, 4);
                setInspectData(str);
            })
            .catch(error => {
                if (ac.signal.aborted) {
                    return;
                }
                if (dataModel.errIsNoLogin(error)) {
                    let query = new URLSearchParams();
                    query.append('cb', '/images/' + imageId);
                    navigate('/login?' + query.toString());
                    return;
                }
                let e = error.toString();
                if (error.response) {
                    e = error.response.data;
                }
                setErrMsg(e);
            })
            .finally(() => setLoading(false));
    }, [navigate, imageId]);

    useEffect(() => {
        const ac = new AbortController();
        loadInspectData(ac);
        return () => ac.abort();
    }, [loadInspectData]);

    useEffect(() => {
        const ctrl = getController('bar_breadcrumb');
        const unregister = ctrl.asControllerGuest([{
            text: 'Images',
            href: '/images'
        }, {
            text: imageId
        }]);
        return () => unregister();
    }, [imageId]);

    useEffect(() => {
        document.title = 'ContainerUp - Image ' + imageId;
    }, [imageId]);

    return (
        <>
            {!loading && !errMsg && (
                <Paper
                    component="pre"
                    sx={{fontSize: '12px', padding: '4px', margin: 0}}
                >
                    {inspectData}
                </Paper>
            )}

            {loading && (
                <Paper
                    sx={{fontSize: '12px', padding: '4px', margin: 0}}
                >
                    {[...Array(10)].map((row, i) => (
                        <Fragment key={i}>
                            <Skeleton animation="wave" sx={{width: '35%'}} />
                            <Skeleton animation="wave" sx={{width: '45%'}} />
                            <Skeleton animation="wave" sx={{width: '55%'}} />
                        </Fragment>
                    ))}
                </Paper>
            )}

            {!!errMsg && (
                <Alert severity="error">
                    {errMsg}
                </Alert>
            )}
        </>
    );
}