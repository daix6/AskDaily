<template>
  <div class="calendar">
    <table>
      <thead>
        <tr>
          <th v-for="week in weekdays">{{ week }}</th>
        </tr>
        </thead>
      <tbody>
        <tr v-for="week in days">
          <td v-for="day in week">{{ day.date }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
const MONTHS =  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default {
  data() {
    return {
      year: 0,
      month: 0,
      date: 0,
      days: [],
      today: new Date(),
      firstDay: 5, // 0 for Sunday, 6 for Saturday
      weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    }
  },
  created() {
    this.year = this.today.getFullYear()
    this.month = this.today.getMonth()
    this.date = this.today.getDate()
    // Adjust the sequence of weekdays
    this.firstDay = this.firstDay % 7
    for (let i = 0; i < this.firstDay; i++)
      this.weekdays.push(this.weekdays.shift())
    // Get days
    this.getDays()
  },
  methods: {
    getDays() {
      let currentMonthFirstDay = new Date(this.year, this.month, 1).getDay()
      let currentMonthDays = new Date(this.year, this.month + 1, 0).getDate()
      let lastMonthDays = new Date(this.year, this.month, 0).getDate()

      let days = []
      for (let i = 1, j = 0; i <= currentMonthDays; i++) {
        if (currentMonthFirstDay !== this.firstDay) {
          while (j < (currentMonthFirstDay - this.firstDay + 7) % 7) {
            days.push({
              date: lastMonthDays - j++
            })
          }
        }
        days.push({
          date: i
        })
      }
      let mod = days.length % 7
      for (let i = 1; i <= 7 - mod; i++)
        days.push({
          date: i
        })

      this.days = []
      for (let i = 0; i < days.length; i += 7)
        this.days.push(days.slice(i, i + 7))
    }
  }
}
</script>
