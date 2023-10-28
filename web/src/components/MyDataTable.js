import {Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow} from "@mui/material";
import {Fragment} from "react";

export default function MyDataTable({data}) {
    return (
        <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="simple table">
                <TableHead>
                {data[0] && (
                    <TableRow>
                        <TableCell sx={{width: 160}}>
                            {data[0].label}
                        </TableCell>
                        <TableCell variant="body" sx={data[0].valueSx}>
                            {data[0].value}
                        </TableCell>
                    </TableRow>
                )}
                </TableHead>

                <TableBody>
                {data.map((d, i) => (
                    <Fragment key={i}>
                        {i > 0 && (
                            <TableRow>
                                <TableCell variant="head">
                                    {d.label}
                                </TableCell>
                                <TableCell sx={d.valueSx}>
                                    {d.value}
                                </TableCell>
                            </TableRow>
                        )}
                    </Fragment>
                ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}