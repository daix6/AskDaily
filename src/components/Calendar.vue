<template>
  <div class='calendar'>
    <nav class='calendar-row calendar-ctrl'>
      <ul>
        <li class='prev' v-on:click='prev'></li>
        <li v-if='today.getFullYear() > year || today.getMonth() > month' class='next' v-on:click='next'></li>
        <li class='current move'>{{ title }}</li>
      </ul>
    </nav>
    <div>
      <table class='move'>
        <thead class='calendar-header'>
          <tr class='calendar-row'>
            <th class='calendar-cell' v-for='wd in weekdays'>{{ wd }}</th>
          </tr>
        </thead>
        <tbody class='calendar-body'>
          <tr class='calendar-row' v-for='week in weeks'>
            <td class='calendar-cell' v-for='day in week' >
            <a v-if='day.href && day.isActive' class='calendar-day' :class='{ "now": day.isNow, "active": day.isActive, "valid": day.isValid }' :href='day.href'>
              <span>{{ day.date }}</span>
            </a>
            <span v-else class='calendar-day' :class='{ "now": day.isNow, "active": day.isActive, "valid": day.isValid }'>{{ day.date }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import elementClass from 'element-class';

const MONTHS = ['January', 'February', 'March', 'April', 'May',
     'June', 'July', 'August', 'September', 'October',
     'November', 'December'];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default {
  props: ['data-qs'],
  data() {
    return {
      title: '',
      move: true, // animation
      year: 0,
      month: 0,
      day: 0,
      today: new Date,
      movePrev: false,
      moveNext: false,
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
  watch: {
    movePrev: (val, oldVal) => {
      let moves = document.getElementsByClassName('move');

      if (val)
        for (let i = 0, len = moves.length; i < len; i++)
          elementClass(moves[i]).add('move-prev');
      else
        for (let i = 0, len = moves.length; i < len; i++)
          elementClass(moves[i]).remove('move-prev');
    },
    moveNext: (val, oldVal) => {
      let moves = document.getElementsByClassName('move');

      if (val)
        for (let i = 0, len = moves.length; i < len; i++)
          elementClass(moves[i]).add('move-next');
      else
        for (let i = 0, len = moves.length; i < len; i++)
          elementClass(moves[i]).remove('move-next');
    }
  },
  methods: {
    render() {
      let curMonthFirstDate = new Date(this.year, this.month, 1).getDay(); // The first day current month
      let curMonthDays = new Date(this.year, this.month + 1, 0).getDate();
      let lastMonthDays = new Date(this.year, this.month, 0).getDate();

      this.title = `${MONTHS[this.month]} ${this.year}`;

      this.weeks = [];
      for (let i = 1; i <= curMonthDays;) {
        let week = [];
        let count = 0;

        while (count < 7) {
          let thisDay = new Date(this.year, this.month, i);
          let thisWeekDay = thisDay.getDay();

          if (i === 1 && thisWeekDay !== 0) {
            for (let j = thisWeekDay - 1; j >= 0; j--) {
              week.push({
                date: lastMonthDays - j,
                isNow: false,
                isActive: false,
                isValid: false
              });
              count++;
            }
          }

          week.push({
            date: i,
            isNow: this.sameDay(thisDay, this.today),
            isActive: this.isInActive(thisDay),
            isValid: true,
            href: this.date2href(this.year, this.month, i)
          });
          count++;

          if (i === curMonthDays && thisWeekDay !== 6) {
            for (let j = 1; j < 7 - thisWeekDay; j++) {
              week.push({
                date: j,
                isNow: false,
                isActive: false,
                isValid: false
              });
              count++;
            }
          }

          i++;
        }
        this.weeks.push(week);
      }
    },
    prev() {
      if (this.month === 0) {
        this.month = 11;
        this.year--;
      } else
        this.month--;

      this.move = false;
      this.movePrev = true;
      this.render();
      setTimeout(() => {
        this.movePrev = false;
      }, 100);
    },
    next() {
      if (this.month === 11) {
        this.month = 0;
        this.year++;
      } else
        this.month++;

      this.move = true;
      this.moveNext = true;
      this.render();
      setTimeout(() => {
        this.moveNext = false;
      }, 100);
    },
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
    pad(num, n) {
      let len = num.toString().length;
      while (len < n) {
        num = '0' + num;
        len++;
      }
      return num;
    },
    date2string(date) {
      let d = this.getDate(date);
      return [this.pad(d.year, 4), this.pad(d.month + 1, 2), this.pad(d.day, 2)].join('-');
    },
    sameDay(dateA, dateB) {
      let d1 = this.getDate(dateA), d2 = this.getDate(dateB);
      return d1.year === d2.year && d1.month === d2.month && d1.day === d2.day;
    },
    isInActive(date) {
      return this.actives.indexOf(this.date2string(date)) !== -1;
    },
    date2href(year, month, day) {
      let y = this.pad(year, 4), m = this.pad(month + 1, 2), d = this.pad(day, 2);
      return `./${y}/${m}/${y}-${m}-${d}.html`;
    }
  }
};
</script>

<style lang='postcss' scoped src='./calendar.css'></style>
