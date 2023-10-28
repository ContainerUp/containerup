import {Box} from "@mui/material";
import {getController} from "../lib/HostGuestController";
import {useEffect, useState} from "react";
import ContainerDetailButtons from "./Containers/Detail/ContainerDetailButtons";

const emptyElement = <></>;

export default function AppBarButtons() {
    const [children, setChildren] = useState(emptyElement);
    const [isContainerDetailButtons, setIsContainerDetailButtons] = useState(false);

    useEffect(() => {
        const ctrl = getController('bar_button');
        const hostSide = ctrl.asControllerHost();
        const hostSideOnReceive = hostSide.useOnReceive();

        hostSideOnReceive(c => {
            if (!c) {
                c = emptyElement;
            }
            if (c === 'container_detail_buttons') {
                c = emptyElement;
                setIsContainerDetailButtons(true);
            } else {
                setIsContainerDetailButtons(false);
            }
            setChildren(c);
        });

        return () => hostSideOnReceive(null);
    }, []);

    return (
        <Box component="div">
            {children}
            {isContainerDetailButtons && (
                <ContainerDetailButtons />
            )}
        </Box>
    );
}