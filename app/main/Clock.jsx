import "main/Clock.styl";

import { h, Component } from "preact";
import moment from "moment";

export default class Clock extends Component {
	constructor() {
		super();
		this.state = {
			now: moment()
		};
	}

	componentWillMount() {
		this._timer = setInterval((function() {
			this.setState({
				now: moment()
			});
		}).bind(this), 1000);
	}

	componentWillUnmount() {
		clearInterval(this._timer);
	}

	render(props, state) {
		var timeText;

		if (props.type == "12hr" || props.type == "12hrnopm") {
			timeText = state.now.format("h:mm");
		} else if (props.type == "24hr") {
			timeText = state.now.format("k:mm");
		} else if (props.type == "percent") {
			// TODO: allow changing start/end
			var start = moment().set("hour", 8);
			var end = moment().set("hour", 12 + 3).set("minute", 15);

			if (start.diff(state.now, "hours") > 0) {
				// day hasn't started yet
				timeText = "0%";
			} else if (end.diff(state.now, "hours") < 0) {
				// day is over
				timeText = "100%";
			} else {
				var secondsToEnd = state.now.diff(start);
				var secondsTotal = end.diff(start);
				var percent = Math.floor((secondsToEnd / secondsTotal) * 100);
				timeText = Math.max(percent, 0) + "%";
			}
		}

		return <div class="clock">
			<div class="clockTime">
				{timeText}
				{props.type == "12hr" && <div class="clockTimeAMPM">
					{state.now.format("A")}
				</div>}
			</div>
			{props.showDate && <div class="clockDate">{state.now.format("MMMM Do, YYYY")}</div>}
		</div>;
	}
};