import {Box, Breadcrumbs} from "@mui/material";
import {getController} from "../lib/HostGuestController";
import {useEffect, useState} from "react";
import Link from "@mui/material/Link";
import {Link as RouterLink} from "react-router-dom";
import {styled} from "@mui/material/styles";

const AppName = styled(Link)(({theme}) => ({
    [theme.breakpoints.down('md')]: {
        fontSize: '16px'
    }
}));

export default function AppBarBreadcrumb() {
    const [children, setChildren] = useState([]);

    useEffect(() => {
        const ctrl = getController('bar_breadcrumb');
        const hostSide = ctrl.asControllerHost();
        const hostSideOnReceive = hostSide.useOnReceive();

        hostSideOnReceive(c => {
            if (!c) {
                c = [];
            }
            setChildren(c);
        });

        return () => hostSideOnReceive(null);
    }, []);

    const separator = (
        <Box sx={{fontSize: '16px'}}>/</Box>
    );

    const linkItems = children.slice(0);
    const lastItem = linkItems.pop();

    return (
        <Breadcrumbs
            aria-label="breadcrumb"
            variant="h6"
            component="div"
            separator={separator}
            sx={{ flexGrow: 1 }}
            color="inherit"
        >
            <AppName underline="hover" color="inherit" to="/" component={RouterLink}>
                ContainerUp
            </AppName>
            {linkItems.map((c, i) => (
                <Link
                    key={i}
                    underline="hover"
                    color="inherit"
                    to={c.href}
                    sx={{fontSize: '16px'}}
                    component={RouterLink}
                >
                    {c.text}
                </Link>
            ))}
            {lastItem && (
                <Box sx={{fontSize: '16px'}} component="span">
                    {lastItem.text}
                </Box>
            )}
        </Breadcrumbs>
    );
}