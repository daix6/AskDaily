<template>
  <div class='calendar'>
    <nav>
      <ul>
        <li>&lt;&lt;</li>
        <li>{{ current }}</li>
        <li>&gt;&gt;</li>
      </ul>
    </nav>
    <div class='calendar-body'>
      <table>
        <thead>
          <tr>
            <td v-for='wd in weekdays'>{{ wd }}</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td></td>
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
  data() {
    return {
      weekdays: WEEKDAYS
    }
  }
};
</script>

<style lang='postcss' scoped src='./calendar.css'></style>
