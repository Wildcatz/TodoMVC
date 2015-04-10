/*global jQuery, Handlebars */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function(a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	var util = {
		getApiKey: function () {
			var key = localStorage.getItem("github_key");
			if (!key) {
				key = prompt('What is your GitHub API key?');
				localStorage.setItem("github_key", key);
			}
			return key;
		},

		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';
		}
	};

	var App = {
		init: function () {
			this.todos = [];
			$.getJSON( "https://api.github.com/repos/wildcatz/TodoMVC/issues?access_token=" + util.getApiKey(),
								 this.createIssuesCallback.bind(this));
			this.cacheElements();
			this.bindEvents();

			Router({
				'/:filter': function (filter) {
					this.filter = filter;
					this.render();
				}.bind(this)
			}).init('/all');
		},
		createIssuesCallback: function( data ) {
			$.each ( data, function( key, object ) {
				if(!object.pull_request)
					this.todos.push({id: object.number, title: object.title, body: object.body});
			}.bind(this));
			this.render();
		},
		cacheElements: function () {
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.$todoApp = $('#todoapp');
			this.$header = this.$todoApp.find('#header');
			this.$main = this.$todoApp.find('#main');
			this.$footer = this.$todoApp.find('#footer');
			this.$newTodo = this.$header.find('#new-todo');
			this.$newTodoBody = this.$header.find('#new-todo-body');
			this.$toggleAll = this.$main.find('#toggle-all');
			this.$todoList = this.$main.find('#todo-list');
			this.$count = this.$footer.find('#todo-count');
			this.$clearBtn = this.$footer.find('#clear-completed');
		},
		bindEvents: function () {
			var list = this.$todoList;
			this.$newTodo.on('keyup', this.create.bind(this));
			this.$newTodoBody.on('keyup', this.create.bind(this));
			this.$toggleAll.on('change', this.toggleAll.bind(this));
			this.$footer.on('click', '#clear-completed', this.destroyCompleted.bind(this));
			list.on('change', '.toggle', this.toggle.bind(this));
			list.on('dblclick', 'label', this.edit.bind(this));
			list.on('keyup', '.edit', this.editKeyup.bind(this));
			list.on('focusout', '.edit', this.update.bind(this));
		},
		render: function () {
			var todos = this.getFilteredTodos();
			this.$todoList.html(this.todoTemplate(todos));
			this.$main.toggle(todos.length > 0);
			this.$toggleAll.prop('checked', this.getActiveTodos().length === 0);
			this.renderFooter();
			this.$newTodo.focus();
		},
		renderFooter: function () {
			var todoCount = this.todos.length;
			var activeTodoCount = this.getActiveTodos().length;
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter
			});

			this.$footer.toggle(todoCount > 0).html(template);
		},
		toggleAll: function (e) {
			var isChecked = $(e.target).prop('checked');

			this.todos.forEach(function (todo) {
				todo.completed = isChecked;
			});

			this.render();
		},
		getActiveTodos: function () {
			return this.todos.filter(function (todo) {
				return !todo.completed;
			});
		},
		getCompletedTodos: function () {
			return this.todos.filter(function (todo) {
				return todo.completed;
			});
		},
		getFilteredTodos: function () {
			if (this.filter === 'active') {
				return this.getActiveTodos();
			}

			if (this.filter === 'completed') {
				return this.getCompletedTodos();
			}

			return this.todos;
		},
		destroyCompleted: function () {
			this.todos = this.getActiveTodos();
			this.filter = 'all';
			this.render();
		},
		// accepts an element from inside the `.item` div and
		// returns the corresponding index in the `todos` array
		indexFromEl: function (el) {
			var id = $(el).closest('li').data('id');
			var todos = this.todos;
			var i = todos.length;

			while (i--) {
				if (todos[i].id === id) {
					return i;
				}
			}
		},
		create: function (e) {
			var title = this.$newTodo.val().trim();
			var body = this.$newTodoBody.val().trim();

			if (e.which !== ENTER_KEY || !title) {
				return;
			}

			$.post("https://api.github.com/repos/wildcatz/TodoMVC/issues?access_token=" + util.getApiKey(),
						 JSON.stringify({ "title": title, "body": body }),
						 this.createCallback.bind(this),
						 "json");
		},
		createCallback: function data(data) {
			this.todos.unshift({
				id: data.number,
				title: data.title,
				body: data.body,
				completed: false
			});

			this.$newTodo.val('');
			this.$newTodoBody.val('');

			this.render();
		},
		toggle: function (e) {
			var i = this.indexFromEl(e.target);
			this.todos[i].completed = !this.todos[i].completed;
			this.render();
		},
		edit: function (e) {
			var $input = $(e.target).closest('li').addClass('editing').find('.edit');
			$input.val($input.val()).focus();
		},
		editKeyup: function (e) {
			if (e.which === ENTER_KEY) {
				e.target.blur();
			}

			if (e.which === ESCAPE_KEY) {
				$(e.target).data('abort', true).blur();
			}
		},
		update: function (e) {
			// var el = e.target;
			// var $el = $(el);
			// var val = $el.val().trim();

			// if ($el.data('abort')) {
			// 	$el.data('abort', false);
			// 	this.render();
			// 	return;
			// }

			// var i = this.indexFromEl(el);

			// if (val) {
			// 	this.todos[i].title = val;
			// } else {
			// 	this.todos.splice(i, 1);
			// }

			// this.render();
		}
	};

	window.app = App;
	App.init();
});
