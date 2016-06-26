import createAction, { AnyAction } from 'dojo-actions/createAction';
import request from 'dojo-core/request';

interface TodoActionConfiguration {
	widgetStore: any;
	parentId: string;
}

interface WidgetStateRecord {
	[prop: string]: any;
	id: string;
	classes?: string[];
	label?: string;
	children?: string[];
}

function configure (configuration: TodoActionConfiguration) {
	this.configuration = configuration;
};

function generateId (): string {
	return `${Date.now()}`;
}

const counterUpdate: AnyAction = createAction({
	configure,
	do(options: any) {
		const widgetStore = this.configuration.widgetStore;
		const label = options.count === 1 ? ' item left' : ' items left';

		return Promise.all([
			widgetStore.patch({'id': 'todo-count-number', 'label': options.count.toString()}),
			widgetStore.patch({'id': 'todo-count-label', label})
		]);
	}
});

const createMany: AnyAction = createAction({
	configure,
	do(todos: any[]) {
		const widgetStore = this.configuration.widgetStore;
		const parentId = this.configuration.parentId;

		const children = todos.map((todo: any) => {
			const label = todo.label;
			const id = todo.id || generateId();
			const completed = todo.completed || false;
			const classes = completed ? ['completed'] : [];
			return widgetStore.add({ id, label, completed, classes })
			.then(() => id);
		});

		return Promise.all(children).then((ids) => {
			return widgetStore.get(parentId)
			.then((todosState: WidgetStateRecord) => [...todosState.children, ...ids])
			.then((children: string[]) => {
				return Promise.all([
					widgetStore.patch({ id: parentId, children }),
					counterUpdate.do({'count': children.length})
				]);
			});
		});
	}
});

const create: AnyAction = createAction({
	configure,
	do(options: any) {
		const id = generateId();
		const widgetStore = this.configuration.widgetStore;
		const parentId = this.configuration.parentId;

		const label = options.label;

		return widgetStore.add({ id, label, completed: false, classes: [] })
		.then(() => widgetStore.get(parentId))
		.then((todosState: WidgetStateRecord) => [...todosState.children, id])
		.then((children: string[]) => {
			return Promise.all([
				widgetStore.patch({ id: parentId, children }),
				counterUpdate.do({'count': children.length})
			]);
		})
		.then(() => {
			return request.post('todo/' + id, {
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					id,
					label,
					completed: false
				}
			});
		})
		.then(() => id);
	}
});

interface CompletePatchObject {
	id: string;
	completed: boolean;
	classes?: string[];
}

const todoCompleteClass = 'completed';

function toggleClass(todoItemState: any, className: string) {
	const idx = todoItemState.classes.indexOf(className);
	if (idx  === -1) {
		todoItemState.classes.push(className);
	} else {
		todoItemState.classes.splice(idx, 1);
	}
	return todoItemState.classes;
}

const toggleComplete: AnyAction = createAction({
	configure,
	do(options: any) {
		const widgetStore = this.configuration.widgetStore;
		const itemId = options.id;
		const patchObject: CompletePatchObject = {
			id: itemId,
			completed: options.complete
		};

		return widgetStore.get(itemId)
		.then((todoItemState: any) => toggleClass(todoItemState, todoCompleteClass))
		.then((classes: string[]) => {
			patchObject.classes = classes;
			return widgetStore.patch(patchObject);
		})
		.then(() => {
			return request.post('todo/' + itemId + '/update', {
				headers: {
					'Content-Type': 'application/json'
				},
				data: patchObject
			});
		});
	}
});

const destroy: AnyAction = createAction({
	configure,
	do(options: any) {
		const widgetStore = this.configuration.widgetStore;
		const parentId = this.configuration.parentId;

		const childId = options.id;

		return widgetStore.get(parentId)
		.then((todosState: WidgetStateRecord) => todosState.children.filter((id) => id !== childId))
		.then((children: string[]) => {
			return Promise.all([
				widgetStore.patch({ id: parentId, children }),
				counterUpdate.do({'count': children.length})
			]);
		})
		.then(() => {
			return request.delete('todo/' + childId + '/delete', {
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					id: childId
				}
			});
		})
		.then(() => widgetStore.delete(childId));
	}
});

const enterTodoEdit: AnyAction = createAction({
	configure,
	do(options: any) {
		const widgetStore = this.configuration.widgetStore;
		const itemId = options.id;
		const patchObject: any = {
			id: itemId
		};

		return widgetStore.get(itemId)
		.then((todoItemState: any) => toggleClass(todoItemState, 'editing'))
		.then((classes: string[]) => {
			patchObject.classes = classes;
			return widgetStore.patch(patchObject);
		});
	}
});

const saveTodoEdit: AnyAction = createAction({
	configure,
	do(options: any) {
		const target = <any> options.event.target;
		const widgetStore = this.configuration.widgetStore;
		const itemId = options.id;
		const patchObject: any = {
			id: itemId,
			label: target.value
		};

		if (options.event.keyCode === 13 && target.value) {
			return widgetStore.get(itemId)
			.then((todoItemState: any) => toggleClass(todoItemState, 'editing'))
			.then((classes: string[]) => {
				patchObject.classes = classes;
				return widgetStore.patch(patchObject);
			})
			.then(() => {
				return request.post('todo/' + itemId + '/update', {
					headers: {
						'Content-Type': 'application/json'
					},
					data: patchObject
				});
			});
		}
	}
});

const exitTodoEdit: AnyAction = createAction({
	configure,
	do(options: any) {
		console.log('blur');
	}
});

const filter: AnyAction = createAction({
	configure,
	do(options: any) {
		const widgetStore = this.configuration.widgetStore;
		const allClasses: string[] = [];
		const activeClasses: string[] = [];
		const completedClasses: string[] = [];
		if (options.filter === 'completed') {
			completedClasses.push('selected');
		} else if (options.filter === 'active') {
			activeClasses.push('selected');
		} else {
			allClasses.push('selected');
		}

		return Promise.all([
			widgetStore.patch({'id': 'todo-list', 'filter': options.filter}),
			widgetStore.patch({'id': 'all-filter', 'classes': allClasses}),
			widgetStore.patch({'id': 'active-filter', 'classes': activeClasses}),
			widgetStore.patch({'id': 'completed-filter', 'classes': completedClasses})
		]);
	}
});

function registerAll (configuration: TodoActionConfiguration) {
	create.configure(configuration);
	destroy.configure(configuration);
	toggleComplete.configure(configuration);
	createMany.configure(configuration);
	enterTodoEdit.configure(configuration);
	saveTodoEdit.configure(configuration);
	exitTodoEdit.configure(configuration);
	filter.configure(configuration);
	counterUpdate.configure(configuration);
}

export {
	createMany as createManyAction,
	create as createTodoAction,
	toggleComplete as toggleCompleteTodoAction,
	destroy as destroyTodoAction,
	enterTodoEdit as enterTodoEditAction,
	saveTodoEdit as saveTodoEditAction,
	exitTodoEdit as exitTodoEditAction,
	filter as filterAction,
	counterUpdate as counterUpdateAction,
	registerAll as registerTodoActions
};
