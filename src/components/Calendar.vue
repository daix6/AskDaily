<template>
  <div class='calendar'>
    <nav class='calendar-row calendar-ctrl'>
      <ul>
        <li class='prev' v-on:click='prev'></li>
        <li class='next' v-on:click='next'></li>
        <li class='current'>{{ title }}</li>
      </ul>
    </nav>
    <div>
      <table>
        <thead class='calendar-header'>
          <tr class='calendar-row'>
            <th class='calendar-cell' v-for='wd in weekdays'>{{ wd }}</th>
          </tr>
        </thead>
        <tbody class='calendar-body'>
          <tr class='calendar-row' v-for='week in weeks'>
            <td class='calendar-cell calendar-day' v-for='day in week' v-bind:class='{ "now": day.isNow, "active": day.isActive, "invalid": day.isInvalid }' ><a v-if='day.href' v-bind:href='day.href'>{{ day.date }}</a>
            <span v-else>{{ day.date }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>

const MONTHS = ['January', 'February', 'March', 'April', 'May',
     'June', 'July', 'August', 'September', 'October',
     'November', 'December'];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default {
  props: ['data-qs'],
  data() {
    return {
      title: '',
      year: 0,
      month: 0,
      day: 0,
      today: new Date,
      weeks: [],
      weekdays: WEEKDAYS,
      actives: this.getActives()
    }
  },
  created() {
    let now = this.getDate(this.today);
    this.year = now.year;
    this.month = now.month;
    this.day = now.day;

    this.actives = this.getActives();
    this.render();
  },
  methods: {
    render() {
      let curMonthFirstDate = new Date(this.year, this.month, 1).getDay(); // The first day current month
      let curMonthDays = new Date(this.year, this.month + 1, 0).getDate();
      let lastMonthDays = new Date(this.year, this.month, 0).getDate();

      this.title = `${MONTHS[this.month]} ${this.year}`;

      for (let i = 1; i <= curMonthDays;) {
        let week = [];
        let count = 0;

        while (count < 7) {
          let thisDay = new Date(this.year, this.month, i);
          let thisWeekDay = thisDay.getDay();

          if (i === 1 && thisWeekDay !== 0) {
            for (let j = thisWeekDay - 1; j >= 0; j--) {
              let prevDay = new Date(this.year, this.month - 1, lastMonthDays - j);
              week.push({
                date: j,
                isNow: false,
                isActive: false,
                isInvalid: true
              });
              count++;
            }
          } else {
            week.push({
              date: i,
              isNow: this.sameDay(thisDay, this.today),
              isActive: this.isInActive(thisDay),
              isInvalid: false,
              href: this.date2href(this.year, this.month + 1, i)
            });
            count++;

            if (i === curMonthDays && thisWeekDay !== 6) {
              for (let j = 1; j < 7 - thisWeekDay; j++) {
                let nextDay = new Date(this.year, this.month + 1, j);
                week.push({
                  date: j,
                  isNow: false,
                  isActive: false,
                  isInvalid: true
                });
                count++;
              }
            }

            i++;
          }
        }
        this.weeks.push(week);
      }
      console.log(this);
    },
    prev() {return;},
    next() {return;},
    getActives() {
      return this._props.dataQs.raw.split(',');
    },
    getDate(date) {
      return {
        year: date.getFullYear(),
        month: date.getMonth(),
        day: date.getDate(),
        weekday: date.getDay()
      };
    },
    date2string(date) {
      let d = this.getDate(date);
      return [d.year, d.month, d.day].join('-');
    },
    sameDay(dateA, dateB) {
      let d1 = this.getDate(dateA), d2 = this.getDate(dateB);
      return d1.year === d2.year && d1.month === d2.month && d1.day === d2.day;
    },
    isInActive(date) {
      return this.actives.indexOf(this.date2string(date)) !== -1;
    },
    date2href(year, month, day) {
      function pad(num, n) {
        let len = num.toString().length;
        while (len < n) {
          num = '0' + num;
          len++;
        }
        return num;
      }
      let y = pad(year, 4), m = pad(month, 2), d = pad(day, 2);
      return `/${y}/${m}/${y}-${m}-${d}.html`;
    }
  }
};
</script>

<style lang='postcss' scoped src='./calendar.css'></style>
