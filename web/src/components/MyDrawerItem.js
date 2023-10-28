import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListItem from "@mui/material/ListItem";
import {useLocation, useNavigate} from "react-router-dom";

export default function MyDrawerItem({drawerOpen, text, icon, path, or, href}) {
    const navigate = useNavigate();
    const {pathname} = useLocation();

    const handleClick = () => {
        if (href) {
            window.open(href, '_blank').focus();
            return;
        }
        navigate(path);
    };

    let selected = false;
    if (pathname.indexOf(path) === 0
        && (pathname.length === path.length || pathname[path.length] === '/')) {
        selected = true;
    } else if (or) {
        or.forEach(u => {
            if (u === pathname) {
                selected = true;
            }
        });
    }

    return (
        <ListItem key={text} disablePadding sx={{ display: 'block' }} onClick={handleClick}>
            <ListItemButton
                sx={{
                    minHeight: 48,
                    justifyContent: drawerOpen ? 'initial' : 'center',
                    px: 2.5,
                }}
                selected={selected}
            >
                <ListItemIcon
                    sx={{
                        minWidth: 0,
                        mr: drawerOpen ? 3 : 'auto',
                        justifyContent: 'center',
                    }}
                >
                    {icon}
                </ListItemIcon>
                <ListItemText primary={text} sx={{ opacity: drawerOpen ? 1 : 0 }} />
            </ListItemButton>
        </ListItem>
    );
}