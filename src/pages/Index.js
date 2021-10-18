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

    return(
        <div id="page" className="room" style={styles.page}>

            <form onSubmit={e=>{
                e.preventDefault();
                let fd = new FormData(e.target);
                let room = fd.get("room");
                window.location.href="/"+room;
            }} className="login-form">
                <h3>Create or join room</h3>
                <div className="input-group">
                    <label>Room</label>
                    <input type="text" name="room" placeholder="please enter room name" required/>
                </div>

                <div className="input-group">
                    <button type="submit">Join Now</button>
                </div>
            </form>
        </div>
    )


}
export default Index
