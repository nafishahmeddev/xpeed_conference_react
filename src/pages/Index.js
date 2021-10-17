import React from "react";
import { useHistory } from "react-router-dom";

const styles = {
    "page":{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }
}

function Index(props){
    let history = useHistory();

    return(<div id="page" style={styles.page}>


    </div>)


}
export default Index
