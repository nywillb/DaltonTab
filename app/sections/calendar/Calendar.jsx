import "sections/calendar/Calendar.styl";

import { h, Component } from "preact";
import moment from "moment";

import mhs from "mhs.js";

import MHSConnect from "other/MHSConnect.jsx";
import CalendarEvent from "sections/calendar/CalendarEvent.jsx";

export default class Calendar extends Component {
	componentDidMount() {
		var that = this;
		var token = this.props.storage.mhsToken || "";
		mhs.get(token, "calendar/getStatus", {}, function(statusData) {
			if (statusData.status != "ok") {
				that.setState({
					loaded: true,
					loggedIn: false
				});
				return;
			}
			if (statusData.statusNum != 1) {
				that.setState({
					loaded: true,
					loggedIn: true,
					calendarEnabled: false
				});
				return;
			}

			var mondayDate = moment();
			while (mondayDate.day() != 1) {
				mondayDate.subtract(1, "day");
			}
			
			that.setState({
				loaded: true,
				loggedIn: true,
				calendarEnabled: true,
				token: token,
				monday: mondayDate,
				loadingWeek: true
			}, function() {
				that.loadCurrentWeek.call(that);
				that.setInitialScroll.call(that);
			});
		});
	}

	setInitialScroll() {
		var time = Math.floor((moment().unix() - moment("00:00:00", "HH:mm:ss").unix()) / 60);
		var scrollPos = time - 150;
		if (scrollPos < 0) {
			scrollPos = 0;
		}
		document.querySelector(".calendarViewport").scrollTop = scrollPos;
	}

	loadCurrentWeek() {
		var that = this;
		this.setState({
			loadingWeek: true,
			weekInfo: null
		}, function() {
			mhs.get(that.state.token, "calendar/events/getWeek/" + that.state.monday.format("YYYY-MM-DD"), {}, function(data) {
				that.setState({
					loadingWeek: false,
					weekInfo: data
				});
			});
		});
	}

	jumpToday() {
		var mondayDate = moment();
		while (mondayDate.day() != 1) {
			mondayDate.subtract(1, "day");
		}
		this.setState({
			monday: mondayDate
		}, function() {
			this.loadCurrentWeek();
		});
	}

	jumpWeek(amount) {
		var newDate = moment(this.state.monday);
		newDate.add(amount, "week"); 
		this.setState({
			monday: newDate
		}, function() {
			this.loadCurrentWeek();
		});
	}

	render(props, state) {
		if (!state.loaded) {
			return <div>Loading, please wait...</div>;
		}
		if (!state.loggedIn) {
			return <MHSConnect />;
		}
		if (!state.calendarEnabled) {
			return <MHSConnect type="calendar" />;
		}

		var fridayIndex = (state.loadingWeek ? -1 : state.weekInfo.friday.index);

		var dayHeaders = [];
		var dayContents = [];
		var names = [ "Monday", "Tuesday", "Wednesday", "Thursday", (fridayIndex > 0 ? "Friday " + fridayIndex : "Friday"), "Saturday", "Sunday" ];

		var currentDay = moment(state.monday);

		var sortedEvents = [
			[], [], [], [], [], [], []
		];

		if (!state.loadingWeek) {
			state.weekInfo.events.map(function(e){
				var newEvent = e;
				newEvent.type = "event";
				return newEvent;
			}).concat(state.weekInfo.hwEvents.map(function(e){
				var newEvent = e;
				newEvent.type = "homework";
				return newEvent;
			})).forEach(function(calendarEvent) {
				var start = moment.unix(calendarEvent.start);
				var dow = start.isoWeekday() - 1;
				sortedEvents[dow].push(calendarEvent);
			});
		}

		var earliestEvent = 1440;
		var latestEvent = 0;

		var allGroupsForDays = {};

		for (var dayNumber = 0; dayNumber < 7; dayNumber++) {
			// create list of all events
			var allEvents = [];

			if (!state.loadingWeek) {
				var scheduleEvents = state.weekInfo.scheduleEvents && state.weekInfo.scheduleEvents[dayNumber];
				if (!scheduleEvents) {
					scheduleEvents = [];
				}
				scheduleEvents.forEach(function(event) {
					event.type = "schedule";
					allEvents.push(event);
				});

				allEvents = allEvents.concat(sortedEvents[dayNumber]);
			}

			// group events that occur at same time
			var groupsForDay = [];
			allEvents = allEvents.map(function(eventItem) {
				var isScheduleItem = (eventItem.type == "schedule"); 
				eventItem.groupInfo = {
					dayStart: (isScheduleItem ? moment.unix(0).utc() : moment.unix(eventItem.start).startOf("day").utc()),
					start: moment.unix(eventItem.start).utc(),
					end: moment.unix(eventItem.end).utc(),
				};
				eventItem.groupInfo.offset = eventItem.groupInfo.start.diff(eventItem.groupInfo.dayStart, "minutes");
				eventItem.groupInfo.durationInMinutes = eventItem.groupInfo.end.diff(eventItem.groupInfo.start, "minutes");
				eventItem.groupInfo.height = (eventItem.groupInfo.durationInMinutes < 10 ? 10: eventItem.groupInfo.durationInMinutes);
				eventItem.groupInfo.endOffset = eventItem.groupInfo.offset + eventItem.groupInfo.durationInMinutes;
				eventItem.groupInfo.endOffsetHeight = eventItem.groupInfo.offset + eventItem.groupInfo.height;
				return eventItem;
			});
			allEvents.forEach(function(eventItem, eventItemIndex) {
				// if the earliest time we've found so far is after this
				if (earliestEvent > eventItem.groupInfo.offset) {
					// update the earliest event
					earliestEvent = eventItem.groupInfo.offset;
				}

				// if the latest time we've found so far is before this
				if (latestEvent < eventItem.groupInfo.endOffset) {
					// update the latest event
					latestEvent = eventItem.groupInfo.endOffset;
				}

				// find which group this event belongs to
				var foundGroupIndex = -1;
				for (var groupIndex in groupsForDay) {
					var groupToTest = groupsForDay[groupIndex];
					for (var eventIndex in groupToTest) {
						var groupEventToTest = groupToTest[eventIndex];

						if (
							(eventItem.groupInfo.offset <= groupEventToTest.groupInfo.endOffsetHeight) &&
							(groupEventToTest.groupInfo.offset <= eventItem.groupInfo.endOffsetHeight)
						) {
							foundGroupIndex = groupIndex;
							break;
						}
					}
				}

				if (foundGroupIndex != -1) {
					groupsForDay[foundGroupIndex].push(eventItem);
				} else {
					groupsForDay.push([ eventItem ]);
				}
			});

			allGroupsForDays[dayNumber] = groupsForDay;
		}
		
		var height = latestEvent - earliestEvent;
	
		for (var dayNumber = 0; dayNumber < 7; dayNumber++) {
			// make the elements
			var eventElements = [];
			allGroupsForDays[dayNumber].forEach(function(eventGroup) {
				eventGroup.forEach(function(eventItem, eventGroupIndex) {
					eventElements.push(<CalendarEvent
						event={eventItem}
						type={eventItem.type}
						groupIndex={eventGroupIndex}
						groupLength={eventGroup.length}
						earliestEvent={earliestEvent}
					/>);
				});
			});

			dayHeaders.push(h("div", { class: "calendarDayHeader" }, names[dayNumber] + " " + currentDay.format("M/D")));
			dayContents.push(h("div", { class: "calendarDayContents day" + dayNumber, style: "height: " + height + "px" }, eventElements));
			
			currentDay.add(1, "day");
		}

		return (
			<div class="calendarSection">
				<div class="calendarHeader row">
					<div class="col-md-6 calendarHeaderLeft">
						Week of {state.monday.format("MMMM D, YYYY")}
						<span class="calendarHeaderLoading">{(state.loadingWeek ? " Loading week, please wait...": "")}</span>
					</div>
					<div class="col-md-6 calendarHeaderRight">
						<button class="btn btn-default" onClick={this.jumpWeek.bind(this, -1) }>
							<i class="fa fa-chevron-left" />
						</button>
						<button class="btn btn-default" onClick={this.jumpToday.bind(this) }>Today</button>
						<button class="btn btn-default" onClick={this.jumpWeek.bind(this, 1) }>
							<i class="fa fa-chevron-right" />
						</button>
					</div>
				</div>
				<div class="calendarWeek">{dayHeaders}</div>
				<div class="calendarViewport" style={"height: " + height + "px"}>
					<div class="calendarWeek">{dayContents}</div>
				</div>
			</div>
		);
	}
};