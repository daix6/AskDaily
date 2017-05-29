function Node (value) {
  this.value = value
  this.next = null
}

// 判断是否有环
function isCircular (head) {
  let slow = head
  let fast = head

  while (fast) {
    fast = fast.next
    if (!fast) return false
    else fast = fast.next
    slow = slow.next
    if (slow === fast) return true
  }

  return false
}

// 找到入口点
function getEntrance (head) {
  let slow = head
  let fast = head
  let meet = null

  while (fast) {
    fast = fast.next
    if (!fast) return null
    fast = fast.next
    slow = slow.next
    if (slow === fast) {
      meet = slow
      break
    }
  }

  if (!fast) return null

  slow = head
  while (slow !== meet) {
    slow = slow.next
    meet = meet.next
  }

  return meet
}

function getCircleLength (head) {
  let entry = getEntrance(head)
  let iterator = entry
  let ret = 0
  do {
    iterator = iterator.next
    ret++
  } while (iterator !== entry)

  return ret
}

function getListLength (head) {
  let entry = getEntrance(head)
  let iterator = head
  let ret = 0
  do {
    iterator = iterator.next
    ret++
  } while (iterator !== entry)

  return ret + getCircleLength(head)
}

let oList = new Node(1)
let count = 1
let tail = oList
// 之前我想用 top = oList，但浏览器报错，说 top 已经定义过。
// window 有 top / self / parent 属性，其含义暂略
// 我尝试给这三者赋值，只有 top 会报错，什么鬼:joy:
while (count < 6) {
  tail.next = new Node(++count)
  tail = tail.next
}
tail.next = oList.next.next

if (isCircular(oList)) {
  console.log(getEntrance(oList))     // Node { value: 3, next: [Object] }
  console.log(getCircleLength(oList)) // 4
  console.log(getListLength(oList))   // 6
}
